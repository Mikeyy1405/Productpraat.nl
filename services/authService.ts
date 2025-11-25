
const SESSION_KEY = 'productpraat_auth_session';

// In een echte productie-omgeving zou je dit valideren tegen een server-side database met hashed wachtwoorden.
// Voor deze setup gebruiken we een directe check.
const ADMIN_USER = 'info@writgo.nl';
const ADMIN_PASS = 'Productpraat2025!';

export const authService = {
    login: (email: string, pass: string): boolean => {
        if (email === ADMIN_USER && pass === ADMIN_PASS) {
            localStorage.setItem(SESSION_KEY, 'true');
            return true;
        }
        return false;
    },

    logout: () => {
        localStorage.removeItem(SESSION_KEY);
    },

    isAuthenticated: (): boolean => {
        return localStorage.getItem(SESSION_KEY) === 'true';
    }
};
