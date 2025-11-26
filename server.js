app.get('*', (req, res, next) => {
    // Skip for static assets (js, jsx, ts, tsx, css, json, images, fonts, etc)
    if (req.path.match(/\.(js|jsx|ts|tsx|css|json|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/)) {
        return next();
    }
    
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    
    fs.readFile(indexPath, 'utf8', (err, htmlData) => {
        if (err) {
            console.error('Error reading index.html', err);
            return res.status(500).send('Server Error');
        }

        // Inject vars into window.__ENV__
        const envScript = `
            <script>
                window.__ENV__ = {
                    VITE_SUPABASE_URL: "${VITE_SUPABASE_URL}",
                    VITE_SUPABASE_ANON_KEY: "${VITE_SUPABASE_ANON_KEY}"
                };
            </script>
        `;

        // Insert script before </head>
        const finalHtml = htmlData.replace('</head>', `${envScript}</head>`);
        
        res.send(finalHtml);
    });
});
