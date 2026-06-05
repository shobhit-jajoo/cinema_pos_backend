import express from 'express';
import { addMovie, getActiveMovies } from '../controllers/movieController.js';

const router = express.Router();

// Route to get all active movies -> GET /api/movies
router.get('/', getActiveMovies);

// Route to add a new movie -> POST /api/movies
router.post('/', addMovie);

export default router;