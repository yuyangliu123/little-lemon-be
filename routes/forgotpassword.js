
// To connect with mongoDB database
const mongoose = require('./db');




// For backend and express
const express = require('express');
const forgotpassword = express();
const cors = require("cors");
const bcrypt = require("bcrypt")
const saltRounds = 10;
const jwt = require("jsonwebtoken")
const uuid = require("uuid")
const nodemailer = require("nodemailer")
require("dotenv").config()
const SECRET_KEY = process.env.SECRET_KEY;
const { string } = require('yup');
const { Reset, User } = require('../model/models');
console.log("App listen at port 5000");
forgotpassword.use(express.json());
forgotpassword.use(cors());
forgotpassword.get("/", (req, resp) => {

  resp.send("App is Working");
  // Can check backend is working or not by
  // entering http://localhost:5000
  // If you see App is working means
  // backend working properly
});
const createJwtToken = (email, token, expiresIn) => {
  const payload = {
    email: email,
    token: token,
  };
  const token1 = jwt.sign(payload, SECRET_KEY, { expiresIn: expiresIn });
  return token1;
};


// This route handler processes user login requests for the '/forgotpassword' path.
forgotpassword.post("/send", async (req, resp) => {
  try {
    // Find a user instance with the email from the request body.
    const user = await User.findOne({ email: req.body.email });
    const token = await bcrypt.hash(uuid.v4(), saltRounds)
    if (user && token) {
      console.log("reset start", user, token);

      const checkReset = await Reset.findOne({ email: req.body.email })
      if (checkReset) {
        await Reset.deleteOne({ email: req.body.email })
      } else {
        const reset = new Reset({
          email: user.email,
          token: token, // Store the hashed token
        });
        // Asynchronously save the new user to the database.
        await reset.save();
        const checkReset = await Reset.findOne({ email: req.body.email })
        if (checkReset) {
          const resetToken = createJwtToken(req.body.email, token, process.env.TOKEN_LIFE_TIME)
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER,
              pass: process.env.GMAIL_PASS,
            },
          });
          await transporter.verify();
          const mailOptions = {
            from: process.env.GMAIL_USER,
            to: req.body.email,
            subject: "Link To Reset Password",
            text:
              `http://localhost:3000/resetpassword/?token=${resetToken}`
          }
          await new Promise((resolve, reject) => {
            transporter.sendMail(mailOptions, (err, resp) => {
              if (err) {
                console.error("Something went wrong: ", err);
                reject(err)
              } else {
                console.log(resp);
                resolve(resp)
              }
            })
          })
          resp.status(200).send("reset email sent");
        }
      }
    } else {
      // If the user does not exist, send an error message.
      resp.status(400).send("User does not exist");
    }

  } catch (e) {
    resp.status(400).send(`Something Went Wrong, ${e}`);
  }
});


// This route handler processes user login requests for the '/forgotpassword' path.
forgotpassword.post("/checkvalidate", async (req, resp) => {
  try {
    // Find a user instance with the email from the request body.
    const user = await User.findOne({ email: req.body.email });
    //Check if token exist in database
    const existToken = await Reset.findOne({ token: req.body.token })
    if (user && existToken) {
      resp.status(200).send({ email: req.body.email })
    } else {
      // If the user does not exist or token not exist in database, send an error message.
      resp.status(400).send("User does not exist or token expire");
    }
  } catch (e) {
    resp.status(400).send(`Something Went Wrong, ${e}`);
  }
});

forgotpassword.post("/reset", async (req, resp) => {
  try {
    // Find a user instance with the email from the request body.
    const user = await User.findOne({ email: req.body.email });
    //Compare if enter same password
    const samepassword = await bcrypt.compare(req.body.password, user.password);
    if (samepassword) {
      resp.status(401).send("The new password is the same as the old password.")
    } else if (!user) {
      // If the user does not exist, send an error message.
      resp.status(402).send("User does not exist");
    } else if (user && !samepassword) {
      const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
      // Update password
      await User.findOneAndUpdate({ email: req.body.email }, { password: hashedPassword });
      // Delete reset password database to prevent user use same link to reset their password
      await Reset.deleteOne({ email: req.body.email })
      resp.status(200).send("Reset password")
    }
  } catch (e) {
    resp.status(400).send(`Something Went Wrong, ${e}`);
  }
});

module.exports = forgotpassword;
