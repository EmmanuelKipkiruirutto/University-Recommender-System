document.addEventListener('DOMContentLoaded', () => {
    const emailSection = document.getElementById('emailSection');
    const tokenSection = document.getElementById('tokenSection');
    const resetSection = document.getElementById('resetSection');
    
    const emailForm = document.getElementById('emailForm');
    const tokenForm = document.getElementById('tokenForm');
    const resetForm = document.getElementById('resetForm');
    
    let userEmail = '';

    // Helper function to show one section and hide others
    const showSection = (sectionToShow) => {
        // Hide all sections
        emailSection.classList.add('hidden');
        tokenSection.classList.add('hidden');
        resetSection.classList.add('hidden');
        
        // Show the requested section
        sectionToShow.classList.remove('hidden');
    };

    emailForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;

        try {
            const response = await fetch('http://localhost:3000/api/auth/forgot-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (response.ok) {
                userEmail = email;
                showSection(tokenSection);
                alert('A reset token has been sent to your email');
            } else {
                alert(data.error || 'Email not found. Please check your email address.');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        }
    });

    tokenForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = document.getElementById('resetToken').value;

        try {
            const response = await fetch('http://localhost:3000/api/auth/verify-reset-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email: userEmail,
                    token: token
                })
            });

            const data = await response.json();
            if (response.ok && data.valid) {
                showSection(resetSection);
            } else {
                alert(data.error || 'Invalid token. Please try again.');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        }
    });

    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            alert('Passwords do not match');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/auth/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: userEmail,
                    newPassword
                })
            });

            const data = await response.json();
            if (response.ok) {
                alert('Password reset successful. Please login with your new password.');
                window.location.href = '/login.html';
            } else {
                alert(data.error || 'Failed to reset password. Please try again.');
            }
        } catch (error) {
            alert('An error occurred. Please try again.');
        }
    });
});