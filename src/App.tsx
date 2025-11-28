import React from 'react';
import AdminPanel from './AdminPanel';
import SimpleDashboard from './SimpleDashboard'; // Imported SimpleDashboard

function App() {
    // ... other logic

    return (
        <div>
            {/* ... other components */}
            {/* Replacing AdminPanel with SimpleDashboard */}
            <SimpleDashboard products={products} onLogout={onLogout} />
        </div>
    );
}

export default App;