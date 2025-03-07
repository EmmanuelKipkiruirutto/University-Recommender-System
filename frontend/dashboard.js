//Dashboard script
// Check authentication
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/index.html';
        return;
    }

    // Fetch user data
    fetchUserData();
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/frontend/index.html';
});

// Fetch user data from the backend
async function fetchUserData() {
    try {
        const response = await fetch('http://localhost:3000/api/user/profile', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        // You can use the user data to personalize the dashboard
        // For example, show the user's name in the welcome message
        updateWelcomeMessage(userData.fullName);
    } catch (error) {
        console.error('Error fetching user data:', error);
        // Handle error appropriately
    }
}

// Update welcome message with user's name
function updateWelcomeMessage(userName) {
    const welcomeHeading = document.querySelector('.welcome-section h1');
    welcomeHeading.textContent = `Welcome, ${userName}!`;
}

// Add smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector(this.getAttribute('href')).scrollIntoView({
            behavior: 'smooth'
        });
    });
});

// Add animation on scroll for feature cards
const observerOptions = {
    threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.feature-card').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    observer.observe(card);
});
