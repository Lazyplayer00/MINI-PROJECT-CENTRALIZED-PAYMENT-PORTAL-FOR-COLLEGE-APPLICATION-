const mysql = require("mysql");

const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DATABASE
});

exports.fetchfees = (req, res) => {
    const userCookie = req.cookies.user_data;
  
    if (userCookie) {
      const userData = JSON.parse(userCookie);
      const rollno = userData.rollno;
  
      const query = 'SELECT Deadline, Paid, FineImposed, Scholarship FROM fees WHERE rollno = ?';
  
      db.query(query, [rollno], (error, results, fields) => {
        if (error) {
          console.error('Error fetching fees:', error);
          res.status(500).send('An error occurred while fetching fees');
        } else {
          // Assuming `results` contains the fetched fee details
          const feeDetails = {
            Deadline: results[0].Deadline,
            Paid: results[0].Paid,
            FineImposed: results[0].FineImposed,
            Scholarship: results[0].Scholarship,
          };
  
          // Set the fetched fee details in a cookie named 'fee_details'
          res.cookie('fee_details', JSON.stringify(feeDetails), { maxAge: 86400000 }); // Adjust maxAge as needed
  
          res.json(results); // Sending data as JSON response
        }
      });
    } else {
      res.status(400).send('No user data found in the cookie');
    }
  };
  
