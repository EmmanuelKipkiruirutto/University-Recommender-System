// Check authentication
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/frontend/index.html';
        return;
    }
    
    loadFavorites();
});

// DOM Elements
const loadingOverlay = document.getElementById('loadingOverlay');
const emptyState = document.getElementById('emptyState');
const favouritesGrid = document.getElementById('favouritesGrid');

// Load Favorites
async function loadFavorites() {
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
        
        if (favorites.length === 0) {
            showEmptyState();
        } else {
            showFavorites(favorites);
        }
    } catch (error) {
        console.error('Error loading favorites:', error);
        alert('Failed to load favorites');
    } finally {
        loadingOverlay.classList.add('hidden');
    }
}
// Show Empty State
function showEmptyState() {
    emptyState.classList.remove('hidden');
    favouritesGrid.classList.add('hidden');
}

// Show Favorites
function showFavorites(favorites) {
    emptyState.classList.add('hidden');
    favouritesGrid.classList.remove('hidden');
    
    favouritesGrid.innerHTML = favorites.map(university => createFavoriteCard(university)).join('');
    
   
}

// Create Favorite Card
function createFavoriteCard(university) {
    // Start with a placeholder logo
    let logoUrl = '/frontend/images/logo.png';
    
    // Fetch the university logo
    fetch(`http://localhost:3000/api/universities/logo/${university.id}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.logo_url) {
            const imgElement = document.querySelector(`#uni-logo-${university.id}`);
            if (imgElement) {
                imgElement.src = data.logo_url;
            }
        }
    })
    .catch(error => console.error('Error fetching logo:', error));

    return `
        <div class="favourite-card" data-id="${university.name}">
            <img id="uni-logo-${university.id}"
                 src="${logoUrl}" 
                 alt="${university.name}" 
                 class="card-image"
                 onerror="this.src='/frontend/images/logo.png'">
            <div class="card-content">
                <h3 class="card-title">${university.name}</h3>
                <div class="card-info">
                    <div class="card-info-item">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${university.location || 'Location not available'}</span>
                    </div>
                    
                </div>
                <div class="card-actions">
                    <button class="remove-btn" onclick="removeFromFavorites('${university.name}')">
                        <i class="fas fa-trash-alt"></i> Remove
                    </button>
                    <a href="university-details.html?id=${university.id}" class="view-details-btn">
                        View Details <i class="fas fa-arrow-right"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
}


// Remove from Favorites
async function removeFromFavorites(universityId) {
    if (!confirm('Are you sure you want to remove this university from your favorites?')) {
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/api/favorites/remove', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ universityName: universityId })
        });

        if (!response.ok) {
            throw new Error('Failed to remove from favorites');
        }

        // Remove card from UI
        const card = document.querySelector(`.favourite-card[data-id="${universityId}"]`);
        if (card) {
            card.style.animation = 'fadeOut 0.3s ease';
            
            setTimeout(() => {
                card.remove();
                
                // Check if any favorites remain
                if (favouritesGrid.children.length === 0) {
                    showEmptyState();
                }
            }, 300);
        }
    } catch (error) {
        console.error('Error removing favorite:', error);
        alert('Failed to remove university from favorites');
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    // Handle logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/frontend/index.html';
    });
});


