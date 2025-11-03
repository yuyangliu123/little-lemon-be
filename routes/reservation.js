//--------------------------------------------------------------------------------------------------//
// To connect with mongoDB database
const mongoose = require('./db');

//--------------------------------------------------------------------------------------------------//
// For backend and express
const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();
const cors = require("cors");
const { string } = require('yup');
console.log("App listen at port 5000");
const { jwtDecode } = require('jwt-decode');
const { Reservation } = require('../model/models');
app.use(express.json());
app.use(cors());

//set sign of cookie
app.use(cookieParser())
const corsOptions = {
	origin: 'http://localhost:3000', // Change to frontend's URL
	credentials: true, // Allow credentials (cookies, authorization headers, etc.)
};
app.use(cors(corsOptions));
app.get("/", (req, resp) => {

	resp.send("App is Working");
	// Can check backend is working or not by
	// entering http://localhost:5000
	// If you see App is working means
	// backend working properly
});
//--------------------------------------------------------------------------------------------------//

//--------------------------------------------------------------------------------------------------//
// This route handler processes user registration requests for the '/register' path.
app.post('/reservation',  async (req, res) => {

	const newUser = new Reservation(req.body);
	// Asynchronously save the new user to the database.
	let result = await newUser.save();
	// Convert the Mongoose document object to a plain JavaScript object.
	result = result.toObject();

	if (result) {
		// Delete the password property from the result object before sending it back to the client.
		delete result.password;
		// Send the request body back as a response.
		res.send(req.body);
		// Log the saved user object to the server's console.
		console.log(result);
	} else {
		res.status(409).send('User already registered');
	}
});

//--------------------------------------------------------------------------------------------------//

//--------------------------------------------------------------------------------------------------//
// This route handler checks for reservations on a specific date and time.
app.get("/checkReservation", async (req, res) => {
	// Extract the reservation date from the query parameters.
	const { resDate } = req.query;

	// Define the time slots.
	const timeSlots = ['17:00', '18:00', '19:00', '20:00', '21:00', '22:00'];

	// Convert the reservation date to a JavaScript Date object.
	const date = new Date(resDate);
	// Create a new Date object for the next day to set up a range.
	const nextDate = new Date(date);
	nextDate.setDate(date.getDate() + 1);

	// Find all reservations that match the given date.
	const reservations = await Reservation.find({
		resDate: {
			$gte: date, // Greater than or equal to the start of the reservation date.
			$lt: nextDate // Less than the start of the next day.
		}
	});

	// Check each time slot.
	const response=timeSlots.map(t=>({
		time:t,
		isOrder:!reservations.some(reservation => reservation.resTime === t)
	}))

	// Send the response back to the client.
	res.json(response);
});

//--------------------------------------------------------------------------------------------------//

module.exports = app;

