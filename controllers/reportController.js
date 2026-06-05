import pool from '../config/database_1535.js';

export const getDashboardReport = async (req, res) => {
    try {
        // 1. Get dates from the query URL, or default to the last 30 days
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        const startDate = req.query.startDate 
            ? new Date(req.query.startDate) 
            : new Date(new Date().setDate(endDate.getDate() - 30));

        // Set endDate to 23:59:59 to ensure it captures the entire final day
        endDate.setHours(23, 59, 59, 999);

        // 2. OVERALL KPIs (Total Users, Tickets, Revenue, Redemptions)
        const kpiQuery = `
            SELECT 
                COUNT(DISTINCT phone_number) as total_unique_users,
                COALESCE(SUM(quantity), 0) as total_tickets_sold,
                COALESCE(SUM(amount_paid), 0) as total_revenue,
                COUNT(CASE WHEN discount_applied = true THEN 1 END) as discounted_transactions,
                COUNT(CASE WHEN is_membership_redeemed = true THEN 1 END) as member_redemptions
            FROM transactions_1535
            WHERE created_at BETWEEN $1 AND $2;
        `;
        const kpiResult = await pool.query(kpiQuery, [startDate, endDate]);

        // 3. MOVIE-WISE BREAKDOWN (Sales and revenue per film)
        const movieQuery = `
            SELECT 
                m.title,
                COALESCE(SUM(t.quantity), 0) as tickets_sold,
                COALESCE(SUM(t.amount_paid), 0) as revenue
            FROM transactions_1535 t
            JOIN movies_1535 m ON t.movie_id = m.id
            WHERE t.created_at BETWEEN $1 AND $2
            GROUP BY m.title
            ORDER BY revenue DESC;
        `;
        const movieResult = await pool.query(movieQuery, [startDate, endDate]);

        // 4. DATE-WISE TREND (Day-by-day breakdown)
        const trendQuery = `
            SELECT 
                DATE(created_at) as sale_date,
                COALESCE(SUM(quantity), 0) as tickets_sold,
                COALESCE(SUM(amount_paid), 0) as daily_revenue
            FROM transactions_1535
            WHERE created_at BETWEEN $1 AND $2
            GROUP BY DATE(created_at)
            ORDER BY sale_date DESC;
        `;
        const trendResult = await pool.query(trendQuery, [startDate, endDate]);

        // 5. Send the unified report back to Flutter
        res.status(200).json({
            dateRange: { start: startDate, end: endDate },
            kpis: kpiResult.rows[0],
            movieBreakdown: movieResult.rows,
            dailyTrend: trendResult.rows
        });

    } catch (error) {
        console.error("Report Generation Error:", error);
        res.status(500).json({ message: "Failed to generate dashboard report." });
    }
};