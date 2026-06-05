import pool from '../config/database_1535.js';

// 1. Add a new movie to the cinema listing
export const addMovie = async (req, res) => {
    const { title, basePrice, discountAmount } = req.body;

    // Validation: Ensure title is provided
    if (!title || title.trim() === "") {
        return res.status(400).json({ message: "Movie title is required." });
    }

    try {
        const queryText = `
            INSERT INTO movies_1535 (title, is_active, base_price, discount_amount) 
            VALUES ($1, true, $2, $3) 
            RETURNING *;
        `;
        // Defaults to 150/50 if nothing is passed from Flutter
        const result = await pool.query(queryText, [title.trim(), basePrice || 150, discountAmount || 50]);
        
        res.status(201).json({
            message: "Movie added successfully!",
            movie: result.rows[0]
        });
    } catch (error) {
        console.error("Error adding movie:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

// 2. Get all currently showing/active movies
export const getActiveMovies = async (req, res) => {
    try {
        const queryText = `
            SELECT id, title, is_active, base_price, discount_amount 
            FROM movies_1535 
            WHERE is_active = true 
            ORDER BY created_at DESC;
        `;
        const result = await pool.query(queryText);
        
        res.status(200).json(result.rows);
    } catch (error) {
        console.error("Error fetching active movies:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};