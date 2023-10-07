function generatePDF() {
    const doc = new jsPDF();
    
    // Define the content of your PDF here
    const receiptContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Tuition Fee Receipt</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          background-color: #f5f5f5;
          margin: 0;
          padding: 0;
        }
    
        .receipt {
          width: 500px;
          margin: 20px auto;
          background-color: white;
          border-radius: 5px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.2);
          padding: 20px;
        }
    
        .receipt-header {
          text-align: center;
          margin-bottom: 20px;
        }
    
        .receipt-header h1 {
          color: #007bff; /* D. Y. Patil University's blue color */
          font-size: 24px;
          margin: 0;
          font-weight: bold;
        }
    
        .receipt-header h2 {
          font-size: 18px;
          margin: 5px 0;
        }
    
        .receipt-body {
          padding: 20px;
        }
    
        .receipt-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
    
        .receipt-table th,
        .receipt-table td {
          border: 1px solid #ccc;
          padding: 10px;
          text-align: left;
        }
    
        .student-details th {
          width: 30%;
        }
    
        .receipt-table th {
          background-color: #f5f5f5;
        }
    
        .receipt-table td {
          background-color: #ffffff;
        }
    
        .receipt-table td.total {
          font-weight: bold;
          background-color: #f5f5f5;
        }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="receipt-header">
          <h1>D. Y. Patil University Ramrao Adik Institute of Technology</h1>
          <h2>Tuition Fee Receipt</h2>
        </div>
    
        <table class="receipt-table student-details">
            <tr>
              <th>Student Name:</th>
              <td>[Name]</td>
            </tr>
            <tr>
              <th>Roll Number:</th>
              <td>[Roll No.]</td>
            </tr>
            <tr>
              <th>Division:</th>
              <td>[Division]</td>
            </tr>
            <tr>
              <th>Branch:</th>
              <td>[Branch]</td>
            </tr>
            <tr>
                <th>Mode of Payment:</th>
                <td>[Mode of Payment]</td>
              </tr>
          </table>
    
        <div class="receipt-body">
          <table class="receipt-table">
            <tr>
              <th>Tuition Fee Paid:</th>
              <td>INR 3,25,000</td>
            </tr>
            <tr>
              <th>Date of Payment:</th>
              <td>[Date]</td>
            </tr>
          </table>
        </div>
      </div>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.4.0/jspdf.umd.min.js"></script>
    </body>
    </html>
    
    `;
  
    // Convert the HTML content to a data URL
    doc.html(receiptContent, {
      callback: function (pdf) {
        // Save the PDF with a specific file name
        pdf.save('tuition_receipt.pdf');
      },
    });
  }
  