const mysql = require("mysql");


const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DATABASE
});


exports.login = (req, res) => {
  
    const email = req.body.email;
    const password = req.body.password;

  
    db.query('SELECT * FROM user WHERE email = ? AND password =?', [email,password], (error, results) => {
      if (error) {
        console.log(error);
        return res.status(500).json({ error: "Internal Server Error" });
      }
      if (results.length > 0) {
        
        console.log("User found.");
        const user = {
          name: results[0].name,
          email: results[0].email,
          rollno: results[0].rollno,
          course: results[0].course,
        };
        // Serialize the user object as JSON
        const userJSON = JSON.stringify(user);

        // Set the user_data cookie with the serialized user object
        res.cookie('user_data', userJSON, { maxAge: 86400000 });
        res.status(200).redirect("/userpage"); // Redirect upon successful login
      } 
      else {

        console.log("User not found. Redirecting to login page.");
        res.status(401).json({ message: 'Incorrect username or password' }); // Send JSON response for incorrect credentials
      }
    });
  };

 
 