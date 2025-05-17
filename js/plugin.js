let currentImages = [];
let currentIndex = 0;
let isInitialized = false;
let titlePageOffset = 0;
let mangaMode = false;
let preloadedImages = new Map(); // Store preloaded images

// Initialize the plugin
eagle.onPluginCreate((plugin) => {
	console.log('Mangaread plugin created');
	console.log(plugin);
	isInitialized = true;
	setupEventListeners();
});

// Setup event listeners for buttons
function setupEventListeners() {
	document.getElementById('prevBtn').addEventListener('click', showPreviousPanels);
	document.getElementById('nextBtn').addEventListener('click', showNextPanels);
	document.getElementById('titlePageToggle').addEventListener('change', handleTitlePageToggle);
	document.getElementById('mangaModeToggle').addEventListener('change', handleMangaModeToggle);
	document.getElementById('pageJumpInput').addEventListener('change', handlePageJump);
	document.getElementById('fullscreenBtn').addEventListener('click', toggleFullscreen);
	
	// Add click handlers for navigation areas
	document.getElementById('leftNavArea').addEventListener('click', showPreviousPanels);
	document.getElementById('rightNavArea').addEventListener('click', showNextPanels);
	
	// Add keyboard event listener
	document.addEventListener('keydown', handleKeyPress);

	// Add toolbar visibility handlers
	setupToolbarVisibility();
}

// Setup toolbar visibility handling
function setupToolbarVisibility() {
	const toolbar = document.querySelector('.toolbar');
	let toolbarTimeout;

	// Create toolbar trigger area
	const trigger = document.createElement('div');
	trigger.className = 'toolbar-trigger';
	document.body.appendChild(trigger);

	// Show toolbar on mouse move near top
	document.addEventListener('mousemove', (e) => {
		if (!document.fullscreenElement) return;

		if (e.clientY <= 60) {
			toolbar.classList.remove('hidden');
			clearTimeout(toolbarTimeout);
		} else {
			toolbarTimeout = setTimeout(() => {
				toolbar.classList.add('hidden');
			}, 1000);
		}
	});

	// Hide toolbar when leaving trigger area
	trigger.addEventListener('mouseleave', () => {
		if (document.fullscreenElement) {
			toolbarTimeout = setTimeout(() => {
				toolbar.classList.add('hidden');
			}, 1000);
		}
	});
}

// Handle title page toggle
function handleTitlePageToggle(event) {
	titlePageOffset = event.target.checked ? 1 : 0;
	currentIndex = 0;
	displayCurrentPanels();
}

// Handle manga mode toggle
function handleMangaModeToggle(event) {
	mangaMode = event.target.checked;
	
	// Swap the click handlers for navigation areas
	const leftNavArea = document.getElementById('leftNavArea');
	const rightNavArea = document.getElementById('rightNavArea');
	
	// Remove existing listeners
	leftNavArea.replaceWith(leftNavArea.cloneNode(true));
	rightNavArea.replaceWith(rightNavArea.cloneNode(true));
	
	// Get fresh references after cloning
	const newLeftNavArea = document.getElementById('leftNavArea');
	const newRightNavArea = document.getElementById('rightNavArea');
	
	// Add listeners based on manga mode
	if (mangaMode) {
		newLeftNavArea.addEventListener('click', showNextPanels);
		newRightNavArea.addEventListener('click', showPreviousPanels);
	} else {
		newLeftNavArea.addEventListener('click', showPreviousPanels);
		newRightNavArea.addEventListener('click', showNextPanels);
	}
	
	displayCurrentPanels();
}

// Handle page jump
function handlePageJump(event) {
	const input = event.target;
	const pageNumber = parseInt(input.value);
	const totalPages = currentImages.length;
	
	if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > totalPages) {
		// Reset to current page if invalid
		input.value = currentIndex * 2 + titlePageOffset + 1;
		return;
	}
	
	// Convert to 0-based index and account for title page offset
	const newIndex = Math.floor((pageNumber - 1 - titlePageOffset) / 2);
	if (newIndex >= 0 && newIndex * 2 + titlePageOffset < totalPages) {
		currentIndex = newIndex;
		displayCurrentPanels();
	}
}

// Handle fullscreen toggle
function toggleFullscreen() {
	const container = document.querySelector('.container');
	const fullscreenBtn = document.getElementById('fullscreenBtn');
	const fullscreenIcon = fullscreenBtn.querySelector('svg');
	const fullscreenText = fullscreenBtn.querySelector('span');
	const toolbar = document.querySelector('.toolbar');
	
	if (!document.fullscreenElement) {
		// Enter fullscreen
		container.requestFullscreen().catch(err => {
			console.error(`Error attempting to enable fullscreen: ${err.message}`);
		});
		fullscreenIcon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
		fullscreenText.textContent = 'Exit Fullscreen';
		toolbar.classList.add('hidden');
	} else {
		// Exit fullscreen
		document.exitFullscreen();
		fullscreenIcon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
		fullscreenText.textContent = 'Fullscreen';
		toolbar.classList.remove('hidden');
	}
}

// Handle keyboard navigation
function handleKeyPress(event) {
	// Only handle if not typing in an input field
	if (event.target.tagName === 'INPUT') return;
	
	switch(event.key) {
		case 'ArrowLeft':
			showPreviousPanels();
			break;
		case 'ArrowRight':
			showNextPanels();
			break;
		case 'F11':
			event.preventDefault(); // Prevent browser's default F11 behavior
			toggleFullscreen();
			break;
	}
}

// Load images when plugin is run
eagle.onPluginRun(() => {
	console.log('Mangaread plugin running');
	if (isInitialized) {
		loadImages();
	}
});

// Handle plugin visibility
eagle.onPluginShow(() => {
	console.log('Mangaread plugin shown');
	if (isInitialized) {
		loadImages();
	}
});

eagle.onPluginHide(() => {
	console.log('Mangaread plugin hidden');
});

// Handle plugin exit
eagle.onPluginBeforeExit((event) => {
	console.log('Mangaread plugin exiting');
});

// Convert file path to blob
async function pathToBlob(filePath) {
	try {
		console.log('Attempting to load file from URL:', filePath);
		if (!filePath) {
			throw new Error('No file path provided');
		}
		const response = await fetch(filePath);
		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
		}
		const blob = await response.blob();
		console.log('Successfully loaded file:', blob.type, blob.size);
		return blob;
	} catch (error) {
		console.error('Error in pathToBlob:', error);
		throw error;
	}
}

// Preload images
async function preloadImages(startIndex) {
	const preloadCount = 4; // Number of images to preload ahead
	const endIndex = Math.min(startIndex + preloadCount, currentImages.length);
	
	for (let i = startIndex; i < endIndex; i++) {
		if (preloadedImages.has(i)) continue; // Skip if already preloaded
		
		try {
			console.log(`Preloading image ${i + 1} of ${currentImages.length}`);
			const image = currentImages[i];
			const blob = await pathToBlob(image.path);
			const url = URL.createObjectURL(blob);
			
			// Create and load the image
			const img = new Image();
			await new Promise((resolve, reject) => {
				img.onload = () => {
					preloadedImages.set(i, { blob, url, img });
					console.log(`Successfully preloaded image ${i + 1}`);
					resolve();
				};
				img.onerror = reject;
				img.src = url;
			});
		} catch (error) {
			console.error(`Error preloading image ${i + 1}:`, error);
		}
	}
}

// Clean up old preloaded images
function cleanupPreloadedImages(currentIndex) {
	const keepCount = 4; // Number of images to keep in cache
	const startIndex = Math.max(0, currentIndex - 2); // Keep some previous images
	
	// Remove images that are too far behind
	for (const [index, data] of preloadedImages.entries()) {
		if (index < startIndex) {
			URL.revokeObjectURL(data.url);
			preloadedImages.delete(index);
		}
	}
}

// Create image element with proper loading
async function createImage(filePath, index) {
	try {
		console.log('Creating image from path:', filePath);
		if (!filePath) {
			throw new Error('No file path provided');
		}

		// Check if image is preloaded
		if (preloadedImages.has(index)) {
			console.log('Using preloaded image for index:', index);
			const preloaded = preloadedImages.get(index);
			return preloaded.img.cloneNode();
		}

		// If not preloaded, load it normally
		const blob = await pathToBlob(filePath);
		const url = URL.createObjectURL(blob);
		console.log('Created object URL:', url);
		
		const img = new Image();
		img.style.maxWidth = '100%';
		img.style.maxHeight = '100%';
		img.style.objectFit = 'contain';
		img.style.display = 'block';
		
		await new Promise((resolve, reject) => {
			img.onload = () => {
				console.log('Image loaded successfully');
				URL.revokeObjectURL(url);
				resolve(img);
			};
			img.onerror = (error) => {
				console.error('Image failed to load:', error);
				URL.revokeObjectURL(url);
				reject(new Error('Failed to load image'));
			};
			img.src = url;
		});
		
		return img;
	} catch (error) {
		console.error('Error in createImage:', error);
		throw error;
	}
}

// Load images from Eagle
async function loadImages() {
	try {
		console.log('Loading images from Eagle...');
		const images = await eagle.item.getSelected();
		console.log('Selected images:', images);
		
		if (!images || images.length === 0) {
			console.log('No images selected');
			showMessage('Please select some images first');
			return;
		}

		// Clear any existing preloaded images
		for (const data of preloadedImages.values()) {
			URL.revokeObjectURL(data.url);
		}
		preloadedImages.clear();

		// Sort images by name to ensure correct order
		currentImages = images
			.map(img => {
				if (!img.fileURL) {
					console.error('Image missing fileURL:', img);
					throw new Error('Image missing fileURL');
				}
				// Extract the base filename without extension
				const baseName = img.name.replace(/\.[^/.]+$/, "");
				// Try to parse the number from the filename
				const numberMatch = baseName.match(/\d+/);
				const number = numberMatch ? parseInt(numberMatch[0]) : 0;
				
				return {
					...img,
					path: img.fileURL,
					name: img.name,
					sortNumber: number,
					baseName: baseName
				};
			})
			.sort((a, b) => {
				// First try to sort by numbers in the filename
				if (a.sortNumber !== b.sortNumber) {
					return a.sortNumber - b.sortNumber;
				}
				// If numbers are the same or not present, sort alphabetically
				return a.baseName.localeCompare(b.baseName);
			});
		
		console.log('Sorted images:', currentImages.map(img => ({
			name: img.name,
			sortNumber: img.sortNumber,
			baseName: img.baseName
		})));
		
		// Update total pages display
		document.getElementById('totalPages').textContent = currentImages.length;
		
		currentIndex = 0;
		await displayCurrentPanels();
	} catch (error) {
		console.error('Error in loadImages:', error);
		showMessage('Error loading images: ' + error.message);
	}
}

// Display current panels
async function displayCurrentPanels() {
	console.log('Displaying panels for index:', currentIndex);
	const leftPanel = document.querySelector('#leftPanel .panel-content');
	const rightPanel = document.querySelector('#rightPanel .panel-content');
	
	if (!leftPanel || !rightPanel) {
		console.error('Panel elements not found');
		return;
	}
	
	// Clear existing content except page numbers
	const leftPageNumber = leftPanel.querySelector('.page-number');
	const rightPageNumber = rightPanel.querySelector('.page-number');
	leftPanel.innerHTML = '';
	rightPanel.innerHTML = '';
	leftPanel.appendChild(leftPageNumber);
	rightPanel.appendChild(rightPageNumber);
	
	try {
		// Display current and next image with title page offset
		const leftIndex = currentIndex * 2 + titlePageOffset;
		const rightIndex = leftIndex + 1;
		
		// Check if we're at the last single image
		const isLastSingleImage = rightIndex >= currentImages.length;
		
		// Update page numbers based on manga mode and single image state
		if (mangaMode) {
			if (isLastSingleImage) {
				leftPageNumber.textContent = `Page ${leftIndex + 1}`;
				rightPageNumber.textContent = '';
			} else {
				leftPageNumber.textContent = `Page ${rightIndex + 1}`;
				rightPageNumber.textContent = `Page ${leftIndex + 1}`;
			}
		} else {
			if (isLastSingleImage) {
				leftPageNumber.textContent = '';
				rightPageNumber.textContent = `Page ${leftIndex + 1}`;
			} else {
				leftPageNumber.textContent = `Page ${leftIndex + 1}`;
				rightPageNumber.textContent = `Page ${rightIndex + 1}`;
			}
		}
		
		// Update page jump input
		document.getElementById('pageJumpInput').value = leftIndex + 1;
		
		// Create image elements
		let leftImg = null;
		let rightImg = null;
		
		if (leftIndex < currentImages.length) {
			const currentImage = currentImages[leftIndex];
			console.log('Loading left panel image:', {
				index: leftIndex,
				path: currentImage.path,
				id: currentImage.id,
				name: currentImage.name
			});
			
			try {
				leftImg = await createImage(currentImage.path, leftIndex);
				console.log('Successfully loaded left panel image');
			} catch (error) {
				console.error('Failed to load left panel image:', error);
				leftImg = document.createTextNode('Failed to load image: ' + error.message);
			}
		}
		
		if (rightIndex < currentImages.length) {
			const nextImage = currentImages[rightIndex];
			console.log('Loading right panel image:', {
				index: rightIndex,
				path: nextImage.path,
				id: nextImage.id,
				name: nextImage.name
			});
			
			try {
				rightImg = await createImage(nextImage.path, rightIndex);
				console.log('Successfully loaded right panel image');
			} catch (error) {
				console.error('Failed to load right panel image:', error);
				rightImg = document.createTextNode('Failed to load image: ' + error.message);
			}
		}

		// Apply manga mode if enabled
		if (mangaMode) {
			if (isLastSingleImage) {
				// In manga mode, single image goes on the right
				if (leftImg) rightPanel.insertBefore(leftImg, rightPageNumber);
			} else {
				if (rightImg) leftPanel.insertBefore(rightImg, leftPageNumber);
				if (leftImg) rightPanel.insertBefore(leftImg, rightPageNumber);
			}
		} else {
			if (isLastSingleImage) {
				// In normal mode, single image goes on the left
				if (leftImg) leftPanel.insertBefore(leftImg, leftPageNumber);
			} else {
				if (leftImg) leftPanel.insertBefore(leftImg, leftPageNumber);
				if (rightImg) rightPanel.insertBefore(rightImg, rightPageNumber);
			}
		}

		// Start preloading next images
		const nextIndex = currentIndex + 1;
		if (nextIndex * 2 + titlePageOffset < currentImages.length) {
			preloadImages(nextIndex * 2 + titlePageOffset);
		}

		// Clean up old preloaded images
		cleanupPreloadedImages(currentIndex);
	} catch (error) {
		console.error('Error in displayCurrentPanels:', error);
		showMessage('Error displaying images: ' + error.message);
	}
}

// Show previous panels
async function showPreviousPanels() {
	console.log('Previous clicked. Current index:', currentIndex, 'Total images:', currentImages.length);
	if (currentIndex > 0) {
		currentIndex = Math.max(0, currentIndex - 1);
		console.log('New index:', currentIndex);
		try {
			await displayCurrentPanels();
		} catch (error) {
			console.error('Error showing previous panels:', error);
			showMessage('Error navigating to previous images');
		}
	} else {
		console.log('Already at the beginning');
		showMessage('Already at the beginning');
	}
}

// Show next panels
async function showNextPanels() {
	console.log('Next clicked. Current index:', currentIndex, 'Total images:', currentImages.length);
	const nextIndex = currentIndex + 1;
	const rightIndex = nextIndex * 2 + titlePageOffset + 1;
	
	if (rightIndex <= currentImages.length) {
		currentIndex = nextIndex;
		console.log('New index:', currentIndex);
		try {
			await displayCurrentPanels();
		} catch (error) {
			console.error('Error showing next panels:', error);
			showMessage('Error navigating to next images');
		}
	} else {
		console.log('Already at the end');
		showMessage('Already at the end');
	}
}

// Show message to user
function showMessage(message) {
	console.log('Showing message:', message);
	const messageDiv = document.createElement('div');
	messageDiv.style.position = 'fixed';
	messageDiv.style.top = '20px';
	messageDiv.style.left = '50%';
	messageDiv.style.transform = 'translateX(-50%)';
	messageDiv.style.padding = '10px 20px';
	messageDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
	messageDiv.style.color = 'white';
	messageDiv.style.borderRadius = '4px';
	messageDiv.style.zIndex = '1000';
	messageDiv.textContent = message;
	
	document.body.appendChild(messageDiv);
	setTimeout(() => messageDiv.remove(), 3000);
}