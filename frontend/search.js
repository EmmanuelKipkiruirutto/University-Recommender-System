// Check authentication
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/index.html';
        return;
    }
});

// DOM Elements
const searchForm = document.getElementById('searchForm');
const loadingOverlay = document.getElementById('loadingOverlay');
const resultsSection = document.getElementById('resultsSection');
const universityCards = document.getElementById('universityCards');

// Event Listeners
searchForm.addEventListener('submit', handleSearch);
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('token');
    window.location.href = '/frontend/index.html';
});

// Search Handler
async function handleSearch(e) {
    e.preventDefault();
    const description = searchForm.querySelector('textarea').value;

    // Show loading overlay
    loadingOverlay.classList.remove('hidden');
    resultsSection.classList.add('hidden');

    try {
        // Call OpenAI API through your backend
        const response = await fetch('http://localhost:3000/api/universities/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ description })
        });

        if (!response.ok) {
            throw new Error('Search failed');
        }

        const universities = await response.json();
        displayResults(universities);
    } catch (error) {
        console.error('Search error:', error);
        alert('An error occurred while searching. Please try again.');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}

// Display Results
function displayResults(universities) {
    universityCards.innerHTML = ''; // Clear previous results
    
    if (!Array.isArray(universities) || universities.length === 0) {
        console.error('No universities found');
        universityCards.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No Universities Found</h3>
                <p>Try adjusting your search criteria</p>
            </div>
        `;
        return;
    }

    // Filter out universities with 0% match score and sort remaining by match score
    const validUniversities = universities
        .filter(uni => uni.match_score > 0)
        .sort((a, b) => b.match_score - a.match_score);

    if (validUniversities.length === 0) {
        universityCards.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <h3>No Matching Universities Found</h3>
                <p>Try adjusting your search criteria</p>
            </div>
        `;
        return;
    }

    // Take only the top 10 universities
    const topUniversities = validUniversities.slice(0, 10);

    topUniversities.forEach(university => {
        const card = createUniversityCard(university);
        universityCards.appendChild(card);
    });

    resultsSection.classList.remove('hidden');
}
// Create University Card
function createUniversityCard(university) {
    const card = document.createElement('div');
    card.className = 'university-card';
    
    card.innerHTML = `
        <div class="card-header">
            <h4>${university.name}</h4>
            <span class="match-rate">${university.match_score}% Match</span>
        </div>
        <div class="card-body">
            <div class="university-info">
                <p><strong>Location:</strong> ${university.location}</p>
                <p><strong>Best Programs:</strong> ${university.programs.join(', ')}</p>
                <p><strong>Tuition Range (Yearly):</strong> ${university.tuition_range}</p>
                <div class="matched-requirements">
                    <p><strong>Matched Requirements:</strong></p>
                    <ul>
                        ${Array.isArray(university.matched_requirements) 
                            ? university.matched_requirements.map(req => `<li>${req}</li>`).join('')
                            : '<li>No specific matches found</li>'
                        }
                    </ul>
                </div>
            </div>
        </div>
        <div class="card-actions">
            <button class="favorite-btn" data-name="${university.name}">
               
            </button>
            <a href="/frontend/university-details.html?name=${encodeURIComponent(university.name)}" class="view-details-btn" target="_blank">
                View Details <i class="fas fa-arrow-right"></i>
            </a>
        </div>
    `;

    // Add favorite functionality
    const favoriteBtn = card.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', () => toggleFavorite(university.name));

    return card;
}

// Toggle Favorite
async function toggleFavorite(universityName) {
    try {
        const button = document.querySelector(`.favorite-btn[data-name="${universityName}"]`);
        const isCurrentlyFavorited = button.classList.contains('active');
        
        const endpoint = isCurrentlyFavorited ? 'remove' : 'add';
        const method = isCurrentlyFavorited ? 'DELETE' : 'POST';
        
        const response = await fetch(`http://localhost:3000/api/favorites/${endpoint}`, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ universityName })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update favorite');
        }

        // Toggle button state
        button.classList.toggle('active');
        const icon = button.querySelector('i');
        icon.style.color = button.classList.contains('active') ? '#ed64a6' : '#cbd5e0';
        
    } catch (error) {
        console.error('Error updating favorite:', error);
        alert('Failed to update favorite status: ' + error.message);
    }
}
// Check Saved Universities
async function checkSavedUniversities() {
    try {
        const response = await fetch('http://localhost:3000/api/favorites', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch favorites');
        }

        const { data: favorites } = await response.json();
        favorites.forEach(favorite => {
            const button = document.querySelector(`.favorite-btn[data-name="${favorite.name}"]`);
            if (button) {
                button.classList.add('active');
                button.querySelector('i').style.color = '#ed64a6';
            }
        });
    } catch (error) {
        console.error('Error fetching favorites:', error);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    checkSavedUniversities();
});

