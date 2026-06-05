import pool from '../config/database_1535.js';

export const processCheckout = async (req, res) => {
    const { phoneNumber, movieId, isMemberMode, quantity = 1 } = req.body;
    const ticketQty = Number(quantity);

    if (!phoneNumber || !movieId) {
        return res.status(400).json({ message: "Phone number and Movie ID are required." });
    }

    try {
        await pool.query('BEGIN');

        // Fetch dynamic movie parameters
        const movieResult = await pool.query('SELECT id, title, is_active, base_price, discount_amount FROM movies_1535 WHERE id = $1', [movieId]);
        if (movieResult.rows.length === 0 || !movieResult.rows[0].is_active) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: "Selected movie is invalid or inactive." });
        }
        const movie = movieResult.rows[0];

        // Fetch customer profile
        const customerResult = await pool.query('SELECT * FROM customers_1535 WHERE phone_number = $1', [phoneNumber.trim()]);
        if (customerResult.rows.length === 0) {
            await pool.query('ROLLBACK');
            return res.status(404).json({ message: "Customer profile not found." });
        }
        const customer = customerResult.rows[0];

        // -------------------------------------------------------------
        // PATH A: ANNUAL MEMBERSHIP REDEMPTION FLOW
        // -------------------------------------------------------------
        if (isMemberMode) {
            if (!customer.is_member || new Date() > new Date(customer.membership_expiry)) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: "Membership has expired or is inactive." });
            }
            if (customer.tickets_remaining <= 0) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ message: "No membership ticket allowance remaining for this year." });
            }

            const historyCheck = await pool.query(
                'SELECT id FROM member_history_1535 WHERE phone_number = $1 AND movie_id = $2',
                [customer.phone_number, movie.id]
            );
            if (historyCheck.rows.length > 0) {
                await pool.query('ROLLBACK');
                return res.status(400).json({ 
                    message: `Member has already watched "${movie.title}" under this membership. Must purchase at normal rate.` 
                });
            }

            await pool.query('UPDATE customers_1535 SET tickets_remaining = tickets_remaining - 1 WHERE phone_number = $1', [customer.phone_number]);
            await pool.query('INSERT INTO member_history_1535 (phone_number, movie_id) VALUES ($1, $2)', [customer.phone_number, movie.id]);

            const transactionResult = await pool.query(
                `INSERT INTO transactions_1535 (phone_number, movie_id, discount_applied, is_membership_redeemed, amount_paid, quantity)
                 VALUES ($1, $2, false, true, 0.00, 1) RETURNING *;`,
                [customer.phone_number, movie.id]
            );

            await pool.query('COMMIT');
            return res.status(200).json({
                message: "Membership ticket processed successfully!",
                receipt: transactionResult.rows[0],
                movieTitle: movie.title
            });
        }

        // -------------------------------------------------------------
        // PATH B: STANDARD CUSTOMER TWO-VARIABLE SEGREGATION LOGIC
        // -------------------------------------------------------------
        let baseTicketPrice = Number(movie.base_price); 
        let discountAmount = Number(movie.discount_amount);
        let eligibleDiscountQty = 0;
        
        // GAP ANALYSIS: Did they skip a movie entirely?
        let hasSkippedMovie = false;
        if (customer.last_watched_movie_id && customer.last_watched_movie_id < movie.id) {
            const gapCheck = await pool.query(
                'SELECT COUNT(id) FROM movies_1535 WHERE id > $1 AND id < $2 AND is_active = true',
                [customer.last_watched_movie_id, movie.id]
            );
            if (parseInt(gapCheck.rows[0].count) > 0) {
                hasSkippedMovie = true;
            }
        } else if (customer.last_watched_movie_id && customer.last_watched_movie_id > movie.id) {
            hasSkippedMovie = true; 
        }

        // Check if this transaction represents a shift to a new movie release
        const isBrandNewMovie = Number(customer.last_watched_movie_id) !== Number(movie.id);

        let activeDiscountsAvailable = Number(customer.current_movie_discounts);
        let accumulatedNextDiscounts = Number(customer.next_movie_discounts);

        if (isBrandNewMovie) {
            if (hasSkippedMovie) {
                // If they skipped intermediate releases, all rolling pools collapse to 0
                activeDiscountsAvailable = 0;
                accumulatedNextDiscounts = 0;
            } else {
                // Phase Shift: Roll over next pool to become today's current active pool
                activeDiscountsAvailable = accumulatedNextDiscounts;
                // Clear out next movie pool since a fresh movie lifecycle is starting
                accumulatedNextDiscounts = 0;
            }
        }

        // CALCULATE DISCOUNTS (Can only consume from the active current pool)
        if (!customer.is_member && customer.discount_active) {
            eligibleDiscountQty = Math.min(ticketQty, activeDiscountsAvailable);
        }

        // MATH: Invoicing calculations
        const fullPriceQty = ticketQty - eligibleDiscountQty;
        const totalAmountPaid = (eligibleDiscountQty * (baseTicketPrice - discountAmount)) + (fullPriceQty * baseTicketPrice);
        const discountApplied = eligibleDiscountQty > 0;

        // STATE MUTATION
        // 1. Deduct what they consumed from the active current movie bucket
        activeDiscountsAvailable = activeDiscountsAvailable - eligibleDiscountQty;

        // 2. Add today's purchases strictly into the isolated next movie pool
        accumulatedNextDiscounts = accumulatedNextDiscounts + ticketQty;

        // Update the master row
        await pool.query(
            `UPDATE customers_1535 
             SET discount_active = $1, 
                 last_watched_movie_id = $2, 
                 current_movie_discounts = $3,
                 next_movie_discounts = $4
             WHERE phone_number = $5`,
            [!customer.is_member, movie.id, activeDiscountsAvailable, accumulatedNextDiscounts, customer.phone_number]
        );

        // LOG TRANSACTION
        const transactionResult = await pool.query(
            `INSERT INTO transactions_1535 (phone_number, movie_id, discount_applied, is_membership_redeemed, amount_paid, quantity)
             VALUES ($1, $2, $3, false, $4, $5) RETURNING *;`,
            [customer.phone_number, movie.id, discountApplied, totalAmountPaid, ticketQty]
        );

        await pool.query('COMMIT');
        return res.status(200).json({
            message: "Standard ticket checkout completed!",
            receipt: transactionResult.rows[0],
            movieTitle: movie.title,
            discountApplied,
            eligibleDiscountQty 
        });

    } catch (error) {
        await pool.query('ROLLBACK');
        console.error("Critical error during processing checkout:", error);
        res.status(500).json({ message: "Internal server transaction error." });
    }
};