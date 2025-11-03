//--------------------------------------------------------------------------------------------------//
// To connect with mongoDB database
const mongoose = require('./db');

//--------------------------------------------------------------------------------------------------//
// For backend and express
const express = require('express');
const signup = express();
const cors = require("cors");
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { string } = require('yup');
const { User } = require('../model/models');
console.log("App listen at port 5000");
signup.use(express.json());
signup.use(cors());
signup.get("/", (req, resp) => {

	resp.send("App is Working");
	// Can check backend is working or not by
	// entering http://localhost:5000
	// If you see App is working means
	// backend working properly
});
//--------------------------------------------------------------------------------------------------//

//--------------------------------------------------------------------------------------------------//
// This route handler processes user registration requests for the '/register' path.
signup.post("/register", async (req, resp) => {
	try {
	  // Check if a user with the same email already exists.
	  const existingUser = await User.findOne({ email: req.body.email });
	  if (existingUser) {
		// If the user already exists, send an error message.
		return resp.status(401).send('User with this email already exists');
	  }

	  // Hash the password
	  const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);

	  // Create a new user instance with the data from the request body.
	  const user = new User({
		fname: req.body.fname,
		lname: req.body.lname,
		email: req.body.email,
		password: hashedPassword, // Store the hashed password
	  });

	  // Asynchronously save the new user to the database.
	  let result = await user.save();
	  // Convert the Mongoose document object to a plain JavaScript object.
	  result = result.toObject();
	  // Delete the password property from the result object before sending it back to the client.
	  delete result.password;
	  // Send the request body back as a response.
	  resp.send(req.body);
	  // Log the saved user object to the server's console.
	  console.log(result);
	} catch (e) {
	  resp.send(`Something Went Wrong,${e}`);
	}
});

//--------------------------------------------------------------------------------------------------//



module.exports = signup;

