    const express = require('express');
    const cors = require('cors');
    const app = express();
    const port = 3000; // You can choose any available port

    app.use(cors()); // Enable Cross-Origin Resource Sharing
    app.use(express.json()); // Middleware to parse JSON bodies

    app.post('/log', (req, res) => {
      const { source, message, data } = req.body;
      console.log(`[${new Date().toLocaleTimeString()}] [${source.toUpperCase()}]:`, message, data || '');
      res.sendStatus(200);
    });

    app.listen(port, () => {
      console.log(`Extension debug listener running at http://localhost:${port}`);
    });
