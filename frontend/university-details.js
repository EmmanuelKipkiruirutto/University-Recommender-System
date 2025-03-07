// Check authentication
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/index.html';
        return;
    }
    
    // Get university name from URL
    const urlParams = new URLSearchParams(window.location.search);
    const universityName = urlParams.get('name');
    
    if (!universityName) {
        window.location.href = '/frontend/search.html';
        return;
    }

    loadUniversityDetails(universityName);
});

// Logout functionality
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/frontend/index.html';
});

// Load University Details
async function loadUniversityDetails(universityName) {
    try {
        const response = await fetch(`http://localhost:3000/api/universities/details`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ universityName })
        });

        if (!response.ok) {
            throw new Error('Failed to fetch university details');
        }

        const university = await response.json();
        updateUIWithUniversityDetails(university);
    } catch (error) {
        console.error('Error loading university details:', error);
        alert('Failed to load university details');
    } finally {
        document.getElementById('loadingOverlay').classList.add('hidden');
    }
}

// Update UI with University Details
function updateUIWithUniversityDetails(university) {
    // Update header information
    document.getElementById('universityName').textContent = university.name;
    document.getElementById('location').innerHTML = `
        <i class="fas fa-map-marker-alt"></i> ${university.location}
    `;
    document.getElementById('established').innerHTML = `
        <i class="fas fa-calendar-alt"></i> Est. ${university.establishedYear}
    `;
    
    // Update quick stats
    document.getElementById('studentCount').textContent = university.studentPopulation;
    document.getElementById('programCount').textContent = university.totalPrograms;
    document.getElementById('tuition').textContent = university.averageTuition;
    document.getElementById('ranking').textContent = university.ranking || 'N/A';
    
    // Update description
    document.getElementById('universityDescription').textContent = university.description;
    
    // Update programs list
    const programsList = document.getElementById('programsList');
    programsList.innerHTML = university.programs.map(program => `
        <div class="program-item">
            <i class="fas fa-graduation-cap"></i>
            <span>${program}</span>
        </div>
    `).join('');
    
    // Update facilities list
    const facilitiesList = document.getElementById('facilitiesList');
    facilitiesList.innerHTML = university.facilities.map(facility => `
        <div class="facility-item">
            <i class="fas ${getFacilityIcon(facility)}"></i>
            <span>${facility}</span>
        </div>
    `).join('');
    
    // Update contact information
    const contactInfo = document.getElementById('contactInfo');
    contactInfo.innerHTML = `
        <div class="contact-item">
            <i class="fas fa-envelope"></i>
            <span>${university.email || 'N/A'}</span>
        </div>
        <div class="contact-item">
            <i class="fas fa-phone"></i>
            <span>${university.phone || 'N/A'}</span>
        </div>
        <div class="contact-item">
            <i class="fas fa-globe"></i>
            <a href="${university.website || '#'}" target="_blank">${university.website || 'N/A'}</a>
        </div>
    `;
    
    // Add favorite button to header
    const headerActions = document.createElement('div');
    headerActions.className = 'header-actions';
    headerActions.innerHTML = `
        <button class="favorite-btn" onclick="toggleFavorite('${university.name}')">
            <i class="far fa-heart"></i>
            <span>Add to Favorites</span>
        </button>
    `;
    document.getElementById('universityName').parentNode.appendChild(headerActions);
    
    // Check if university is in favorites
    checkFavoriteStatus(university.name);
}

// Get appropriate icon for facility
function getFacilityIcon(facility) {
    const facilityIcons = {
        'library': 'fa-book',
        'laboratory': 'fa-flask',
        'sports': 'fa-futbol',
        'cafeteria': 'fa-utensils',
        'wifi': 'fa-wifi',
        'computer lab': 'fa-desktop',
        'dormitory': 'fa-bed',
        'parking': 'fa-parking',
        'medical': 'fa-hospital',
        'gym': 'fa-dumbbell'
    };

    const facilityLower = facility.toLowerCase();
    for (const [key, icon] of Object.entries(facilityIcons)) {
        if (facilityLower.includes(key)) {
            return icon;
        }
    }
    return 'fa-check-circle';
}

// Add to favorites functionality
async function toggleFavorite(universityName) {
    try {
        const token = localStorage.getItem('token');
        const isFavorited = document.querySelector('.favorite-btn i').classList.contains('fas');
        
        const response = await fetch(`http://localhost:3000/api/favorites/${isFavorited ? 'remove' : 'add'}`, {
            method: isFavorited ? 'DELETE' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ universityName })
        });

        if (response.ok) {
            const favoriteBtn = document.querySelector('.favorite-btn i');
            favoriteBtn.classList.toggle('far');
            favoriteBtn.classList.toggle('fas');
            
            const favoriteText = document.querySelector('.favorite-btn span');
            favoriteText.textContent = isFavorited ? 'Add to Favorites' : 'Remove from Favorites';
        } else {
            throw new Error('Failed to update favorites');
        }
    } catch (error) {
        console.error('Error updating favorites:', error);
        alert('Failed to update favorites. Please try again.');
    }
}

// Check if university is in favorites
async function checkFavoriteStatus(universityName) {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('http://localhost:3000/api/favorites', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.ok) {
            const { data: favorites } = await response.json();
            const isFavorited = favorites.some(fav => fav.university_name === universityName);
            
            const favoriteBtn = document.querySelector('.favorite-btn i');
            const favoriteText = document.querySelector('.favorite-btn span');
            
            if (isFavorited) {
                favoriteBtn.classList.remove('far');
                favoriteBtn.classList.add('fas');
                favoriteText.textContent = 'Remove from Favorites';
            } else {
                favoriteBtn.classList.remove('fas');
                favoriteBtn.classList.add('far');
                favoriteText.textContent = 'Add to Favorites';
            }
        }
    } catch (error) {
        console.error('Error checking favorite status:', error);
    }
}
