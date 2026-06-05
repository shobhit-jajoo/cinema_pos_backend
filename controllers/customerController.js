import pool from '../config/database_1535.js';

// 1. Search for a customer by phone number (Includes Universal Watch History)
export const searchCustomer = async (req, res) => {
    const { phoneNumber } = req.params;

    if (!phoneNumber || phoneNumber.trim() === "") {
        return res.status(400).json({ message: "Phone number is required." });
    }

    try {
        // Query to find the customer profile - FETCHING BOTH SEPARATED POOLS
        const customerQuery = `
            SELECT phone_number, name, discount_active, last_watched_movie_id, is_member, membership_expiry, tickets_remaining, current_movie_discounts, next_movie_discounts 
            FROM customers_1535 
            WHERE phone_number = $1;
        `;
        const customerResult = await pool.query(customerQuery, [phoneNumber.trim()]);

        if (customerResult.rows.length === 0) {
            return res.status(200).json({ exists: false, message: "New customer detected." });
        }

        const customer = customerResult.rows[0];

        // Fetch history from the transaction ledger for EVERYONE
        const historyQuery = `
            SELECT t.id, t.movie_id, m.title as movie_title, t.created_at as watched_at, t.amount_paid 
            FROM transactions_1535 t
            JOIN movies_1535 m ON t.movie_id = m.id
            WHERE t.phone_number = $1
            ORDER BY t.created_at DESC LIMIT 10;
        `;
        const historyResult = await pool.query(historyQuery, [customer.phone_number]);

        // Return unified profile and watch history log together
        res.status(200).json({
            exists: true,
            customer,
            watchHistory: historyResult.rows
        });

    } catch (error) {
        console.error("Error searching customer:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// 2. Register a fresh normal customer profile
export const registerCustomer = async (req, res) => {
    const { phoneNumber, name } = req.body;

    if (!phoneNumber || phoneNumber.trim() === "") {
        return res.status(400).json({ message: "Phone number is required for registration." });
    }

    try {
        const checkExist = await pool.query('SELECT phone_number FROM customers_1535 WHERE phone_number = $1', [phoneNumber.trim()]);
        if (checkExist.rows.length > 0) {
            return res.status(400).json({ message: "This phone number is already registered." });
        }

        const queryText = `
            INSERT INTO customers_1535 (phone_number, name, discount_active, is_member, current_movie_discounts, next_movie_discounts)
            VALUES ($1, $2, false, false, 0, 0)
            RETURNING *;
        `;
        const result = await pool.query(queryText, [phoneNumber.trim(), name ? name.trim() : null]);

        res.status(201).json({
            message: "Customer registered successfully!",
            customer: result.rows[0]
        });
    } catch (error) {
        console.error("Error registering customer:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// 3. Purchase or upgrade a user profile to the 20-Film Annual Membership plan
export const upgradeToMembership = async (req, res) => {
    const { phoneNumber, name } = req.body;

    if (!phoneNumber || phoneNumber.trim() === "") {
        return res.status(400).json({ message: "Phone number is required for membership configuration." });
    }

    try {
        const queryText = `
            INSERT INTO customers_1535 (phone_number, name, is_member, membership_expiry, tickets_remaining)
            VALUES ($1, $2, true, NOW() + INTERVAL '1 year', 20)
            ON CONFLICT (phone_number) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                is_member = true, 
                membership_expiry = NOW() + INTERVAL '1 year', 
                tickets_remaining = 20
            RETURNING *;
        `;
        const result = await pool.query(queryText, [phoneNumber.trim(), name ? name.trim() : null]);

        res.status(200).json({
            message: "Annual membership plan activated successfully!",
            customer: result.rows[0]
        });
    } catch (error) {
        console.error("Error activating membership:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};