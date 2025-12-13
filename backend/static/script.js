// --- Global Functions ---
async function loadLatestJob() {
    try {
        const response = await fetch('/api/latest-job');
        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.error("Error loading latest job:", error);
    }
    return { job_id: null, status: 'none' };
}

function openImagePreview(imagePath) {
    // For now, assuming currentJobId, imagePreviewSrc, and imagePreviewModal are accessible globally
    imagePreviewSrc.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(imagePath)}&max_size=2048`; // Use a larger max_size for preview
    imagePreviewModal.style.display = 'flex';
}

function closeImagePreview() {
    // For now, assuming imagePreviewModal and imagePreviewSrc are accessible globally
    imagePreviewModal.style.display = 'none';
    imagePreviewSrc.src = ''; // Clear image source
}


document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements (Scan Setup Screen) ---
    const dirInput = document.getElementById('dirInput');
    const btnAddDir = document.getElementById('btnAddDir');
    const dirList = document.getElementById('dirList');
    const btnRemoveDir = document.getElementById('btnRemoveDir');
    const algorithmInput = document.getElementById('algorithm');
    const hashSizeInput = document.getElementById('hashSize');
    const btnStartScan = document.getElementById('btnStartScan');
    const btnStopScan = document.getElementById('btnStopScan');
    const btnGoReview = document.getElementById('btnGoReview');
    const scanStatusEl = document.getElementById('scanStatus');
    const scanProgress = document.getElementById('scanProgress');
    const scanProgressFill = document.getElementById('scanProgressFill');
    const scanProgressText = document.getElementById('scanProgressText'); // New DOM element
    const workersInput = document.getElementById('workers');
    const enableSharpnessCheck = document.getElementById('enableSharpnessCheck'); // New DOM element

    // --- DOM Elements (Review Screen) ---
    const screenScanSetup = document.getElementById('screen-scan-setup');
    const screenReview = document.getElementById('screen-review');
    const groupListEl = document.getElementById('groupList');
    const groupFilter = document.getElementById('groupFilter'); // New DOM element
    const groupSort = document.getElementById('groupSort');     // New DOM element
    const groupSortDirection = document.getElementById('groupSortDirection'); // New DOM element
    const btnBackToScanSetup = document.getElementById('btnBackToScanSetup'); // New DOM element
    const heroImg = document.getElementById('heroImg');
    const heroImageText = document.getElementById('heroImageText');
    const heroImageBadge = document.getElementById('heroImageBadge');
    const thumbRow = document.getElementById('thumbRow');
    const sideBySideToggle = document.getElementById('sideBySideToggle'); // New DOM element constant

    const actToggleKeep = document.getElementById('actToggleKeep');
    const actKeepAll = document.getElementById('actKeepAll');
    const actDeleteAll = document.getElementById('actDeleteAll');
    const actTrashNonSuggested = document.getElementById('actTrashNonSuggested');

    const pendingText = document.getElementById('pendingText');
    const btnPrevGroup = document.getElementById('btnPrevGroup'); // New DOM element
    const btnNextGroup = document.getElementById('btnNextGroup'); // New DOM element
    const btnFinalize = document.getElementById('btnFinalize');
    const finalizeModal = document.getElementById('finalizeModal');
    const finalizeMessage = document.getElementById('finalizeMessage');
    const unreviewedWarning = document.getElementById('unreviewedWarning');
    const optCancelFinalize = document.getElementById('optCancelFinalize');
    const optContinueReview = document.getElementById('optContinueReview');
    const optApplyDecision = document.getElementById('optApplyDecision');

    // Image Preview Modal Elements
    const imagePreviewModal = document.getElementById('imagePreviewModal');
    const imagePreviewSrc = document.getElementById('imagePreviewSrc');
    const imagePreviewClose = document.getElementById('imagePreviewClose');

    // Shortcuts Modal Elements
    const shortcutsModal = document.getElementById('shortcutsModal');
    const btnShortcuts = document.getElementById('btnShortcuts');
    const btnShortcutsClose = document.getElementById('btnShortcutsClose');

    // Original Image Viewer Modal Elements
    const originalImageViewerModal = document.getElementById('originalImageViewerModal');
    const originalImageSrc = document.getElementById('originalImageSrc');
    
    const magnifiedImageIndexDisplay = document.getElementById('magnifiedImageIndexDisplay'); // New DOM element

    // --- Magnify Mode State ---
    let isMagnifyMode = false;
    let magnifiedImagePath = null;
    let magnifiedImageIndex = -1; // Index of the currently magnified image within selectedGroup.files

    // --- Functions for Magnify Mode ---
    function openMagnifiedImage(imagePath) {
        if (!selectedGroup) return; // Ensure a group is selected

        magnifiedImagePath = imagePath;
        magnifiedImageIndex = selectedGroup.files.indexOf(imagePath);
        originalImageSrc.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(magnifiedImagePath)}&max_size=2048`; // Use thumbnail as fallback for full image
        originalImageViewerModal.style.display = 'flex';
        
        let indexText = `${magnifiedImageIndex + 1}/${selectedGroup.files.length}`;
        if (magnifiedImagePath === selectedGroup.suggested) {
            magnifiedImageIndexDisplay.innerHTML = `${indexText} <span class="suggested-dot bg-teal-500 rounded-full w-2 h-2 ml-1 inline-block"></span>`;
        } else {
            magnifiedImageIndexDisplay.textContent = indexText;
        }
        document.body.classList.add('overflow-hidden'); // Prevent background scrolling
    }

    function closeMagnifiedImage() {
        magnifiedImagePath = null;
        magnifiedImageIndex = -1;
        originalImageViewerModal.style.display = 'none';
        originalImageSrc.src = '';
        magnifiedImageIndexDisplay.innerHTML = ''; // Clear content including the dot
        document.body.classList.remove('overflow-hidden');
    }

    // Event listeners for closing the image preview modal
    imagePreviewClose.addEventListener('click', closeImagePreview);
    imagePreviewModal.addEventListener('click', (e) => {
        if (e.target === imagePreviewModal) { // Only close if clicked on the overlay, not the image itself
            closeImagePreview();
        }
    });

    // Event listeners for closing the original image viewer modal (magnify mode)
    
    originalImageViewerModal.addEventListener('click', (e) => {
        if (e.target === originalImageViewerModal) { // Only close if clicked on the overlay
            closeMagnifiedImage();
        }
    });

    // --- State ---
    let directories = [];
    let selectedDir = null;
    let dirValidationState = new Map(); // tracks valid/invalid/unknown state per directory
    let currentJobId = null;
    let lastSuccessfulJobId = null; // Track last successful scan for restoration
    let stopRequested = false; // Track if user requested scan stop
    let initialGoReviewEnabled = false;
    let initialScanStatusMessage = '';
    let currentJobDirectories = [];  // Store job directories from API

    // --- Review Screen State ---
    let allGroups = []; // Store the original fetched groups
    let currentGroups = []; // Store the filtered/sorted groups for rendering
    let selectedGroup = null;
    let selectedImage = null;
    let decisions = new Map(); // { groupId: Set<string> of paths to keep }
    let visitedGroups = new Set(); // To track reviewed groups
    let isSideBySideView = false; // New state for side-by-side view
    let currentFilter = 'all'; // New state for filtering groups
    let currentSortBy = 'id'; // New state for sorting groups ('id', 'image_count', 'decision_status')
    let currentSortDirection = 'asc'; // New state for sort direction ('asc', 'desc')

    // --- Functions ---

    /**
     * Parses FastAPI validation error response and extracts failed directory paths
     * @param {Object} errorData - The error response from FastAPI
     * @returns {Array<string>} - Array of invalid directory paths
     */
    function parseValidationErrors(errorData) {
        const invalidPaths = [];

        if (errorData && Array.isArray(errorData.detail)) {
            errorData.detail.forEach(error => {
                // Check if this is a directory validation error
                if (error.loc && error.loc.includes('directories')) {
                    // Extract path from error message
                    const match = error.msg.match(/DirectoryNotFound:(.+)$/);
                    if (match) {
                        invalidPaths.push(match[1]);
                    } else if (error.input) {
                        // Fallback: use the input field
                        invalidPaths.push(error.input);
                    }
                }
            });
        }

        return invalidPaths;
    }

    /**
     * Update Remove Selected button visibility based on directory list
     */
    function updateRemoveButtonVisibility() {
        const hasDirectories = directories.length > 0;
        if (!hasDirectories) {
            btnRemoveDir.style.display = 'none';
        } else {
            btnRemoveDir.style.display = 'inline-flex';
        }
    }

    /**
     * Update Go to Review button visibility based on scan status
     */
    function updateGoReviewVisibility() {
        if (!currentJobId || btnGoReview.disabled) {
            btnGoReview.style.display = 'none';
        } else {
            btnGoReview.style.display = 'inline-flex';
        }
    }

    /**
     * Update Start Scan button state based on directories
     */
    function updateStartScanButton() {
        const hasDirectories = directories.length > 0;
        btnStartScan.disabled = !hasDirectories;

        if (!hasDirectories) {
            btnStartScan.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btnStartScan.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    }

    /**
     * Update toggle button text based on current image state
     */
    function updateToggleButtonText() {
        if (!selectedImage || !selectedGroup) {
            actToggleKeep.textContent = 'Toggle State (K)';
            actToggleKeep.className = 'gradient-button-secondary text-white font-medium py-1 px-3 rounded-md text-sm';
            return;
        }

        const keptPaths = decisions.get(selectedGroup.id) || new Set();
        const isKept = keptPaths.has(selectedImage);

        if (isKept) {
            actToggleKeep.textContent = 'Mark to Delete (K)';
            actToggleKeep.className = 'gradient-button-destructive text-gray-300 font-medium py-1 px-3 rounded-md text-sm';
        } else {
            actToggleKeep.textContent = 'Mark to Keep (K)';
            actToggleKeep.className = 'gradient-button-success text-white font-medium py-1 px-3 rounded-md text-sm';
        }
    }

    function getGroupDecisionStatus(group) {
        const keptPaths = decisions.get(group.id) || new Set();
        const keptCount = keptPaths.size;
        const totalCount = group.files.length;

        if (totalCount === 0) return 'empty';
        if (keptCount === 0) return 'deleted';
        if (keptCount === totalCount) return 'kept';
        return 'mixed';
    }

    function filterAndSortGroups() {
        let filteredGroups = [...allGroups]; // Start with all groups

        // Apply filtering
        if (currentFilter !== 'all') {
            filteredGroups = filteredGroups.filter(group => {
                const isReviewed = visitedGroups.has(group.id);
                const decisionStatus = getGroupDecisionStatus(group);

                switch (currentFilter) {
                    case 'reviewed': return isReviewed;
                    case 'unreviewed': return !isReviewed;
                    case 'kept': return decisionStatus === 'kept';
                    case 'deleted': return decisionStatus === 'deleted';
                    case 'mixed': return decisionStatus === 'mixed';
                    default: return true;
                }
            });
        }

        // Apply sorting
        filteredGroups.sort((a, b) => {
            let valA, valB;

            switch (currentSortBy) {
                case 'id':
                    valA = a.id;
                    valB = b.id;
                    break;
                case 'image_count':
                    valA = a.files.length;
                    valB = b.files.length;
                    break;
                case 'decision_status':
                    valA = getGroupDecisionStatus(a);
                    valB = getGroupDecisionStatus(b);
                    // Custom sort order for decision status
                    const statusOrder = { 'unreviewed': 0, 'mixed': 1, 'kept': 2, 'deleted': 3, 'empty': 4 };
                    return (statusOrder[valA] - statusOrder[valB]) * (currentSortDirection === 'asc' ? 1 : -1);
                default:
                    valA = a.id;
                    valB = b.id;
            }

            if (valA < valB) return currentSortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return currentSortDirection === 'asc' ? 1 : -1;
            return 0;
        });

        currentGroups = filteredGroups; // Update the currentGroups to the filtered and sorted list
        renderGroupList(); // Re-render the list
        // If the selected group is no longer in currentGroups, select the first one or null
        if (selectedGroup && !currentGroups.some(g => g.id === selectedGroup.id)) {
            selectedGroup = currentGroups.length > 0 ? currentGroups[0] : null;
            selectedImage = selectedGroup ? (Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0]) : null;
        } else if (!selectedGroup && currentGroups.length > 0) {
             selectedGroup = currentGroups[0];
             selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
        }
        renderSelectedGroup(); // Re-render selected group to ensure it's correct
        updateGroupNavigationButtons(); // Update buttons based on new currentGroups
    }

    function renderDirs() {
        dirList.innerHTML = '';
        directories.forEach(dir => {
            const div = document.createElement('div');
            const isValid = dirValidationState.get(dir);
            const isInvalid = isValid === false; // explicitly false, not undefined

            // Create container with flex layout for icon + text
            const container = document.createElement('div');
            container.className = 'flex items-center space-x-2';

            // Add validation icon
            const icon = document.createElement('span');
            icon.className = 'flex-shrink-0';
            if (isValid === true) {
                // Purple checkmark for valid
                icon.innerHTML = `<svg class="w-5 h-5 text-[#14b8a6]" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>`;
            } else if (isInvalid) {
                // Red X for invalid
                icon.innerHTML = `<svg class="w-5 h-5 text-[#ef4444]" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>`;
            }

            // Add directory text
            const text = document.createElement('span');
            text.textContent = dir;
            text.className = 'flex-grow truncate';

            container.appendChild(icon);
            container.appendChild(text);
            div.appendChild(container);

            // Base styling
            div.className = 'p-2 rounded-md cursor-pointer mb-2 transition-colors duration-150';

            // Apply validation-based styling
            if (isInvalid) {
                div.classList.add('bg-red-900', 'border-2', 'border-red-500', 'text-white', 'hover:bg-red-800');
            } else if (dir === selectedDir) {
                div.classList.add('bg-gray-700', 'text-white');
            } else {
                div.classList.add('hover:bg-gray-700');
            }

            div.onclick = () => {
                selectedDir = dir;
                renderDirs();
            };
            dirList.appendChild(div);
        });
    }

    function addDirectory() {
        const newDir = dirInput.value.trim();
        if (newDir && !directories.includes(newDir)) {
            directories.push(newDir);
            dirInput.value = '';
            // Clear validation state for new directory (will be validated on scan)
            dirValidationState.delete(newDir);
            hideValidationError(); // Hide error when user makes changes
            renderDirs();
            updateRemoveButtonVisibility();
            updateStartScanButton();
        }
    }

    function removeDirectory() {
        if (selectedDir) {
            directories = directories.filter(d => d !== selectedDir);

            // Remove from validation state
            dirValidationState.delete(selectedDir);

            // If we removed an invalid directory, check if we should hide error
            const hasInvalidDirs = directories.some(dir => dirValidationState.get(dir) === false);
            if (!hasInvalidDirs) {
                hideValidationError();
            }

            selectedDir = null;
            renderDirs();
            updateRemoveButtonVisibility();
            updateStartScanButton();
        }
    }

    /**
     * Shows the validation error alert with specific paths
     * @param {Array<string>} invalidPaths - Array of invalid directory paths
     */
    function showValidationError(invalidPaths) {
        const alertEl = document.getElementById('validationErrorAlert');
        const messageEl = document.getElementById('validationErrorMessage');

        if (invalidPaths.length === 1) {
            messageEl.textContent = `The following directory was not found: "${invalidPaths[0]}"`;
        } else {
            messageEl.innerHTML = `The following directories were not found:<ul class="list-disc list-inside mt-2 space-y-1">
                ${invalidPaths.map(path => `<li class="font-mono text-xs">${path}</li>`).join('')}
            </ul>`;
        }

        alertEl.classList.remove('hidden');

        // Scroll to alert
        alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Hides the validation error alert
     */
    function hideValidationError() {
        const alertEl = document.getElementById('validationErrorAlert');
        alertEl.classList.add('hidden');

        // Also reset scanStatus styling
        const scanStatusEl = document.getElementById('scanStatus');
        scanStatusEl.classList.remove('text-red-400', 'font-semibold');
    }

    /**
     * Shows the no duplicates found alert
     */
    function showNoDuplicatesAlert() {
        const alertEl = document.getElementById('noDuplicatesAlert');
        alertEl.classList.remove('hidden');

        // Scroll to alert
        alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Hides the no duplicates found alert
     */
    function hideNoDuplicatesAlert() {
        const alertEl = document.getElementById('noDuplicatesAlert');
        alertEl.classList.add('hidden');
    }

    /**
     * Shows the stopping scan alert
     */
    function showStoppingScanAlert() {
        const alertEl = document.getElementById('stoppingScanAlert');
        alertEl.classList.remove('hidden');

        // Scroll to alert
        alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Hides the stopping scan alert
     */
    function hideStoppingScanAlert() {
        const alertEl = document.getElementById('stoppingScanAlert');
        alertEl.classList.add('hidden');
    }

    async function startScan() {
        if (directories.length === 0) {
            alert('Please add at least one directory to scan.');
            return;
        }

        // Hide alerts when starting new scan
        hideNoDuplicatesAlert();
        hideStoppingScanAlert();
        hideValidationError();

        const payload = {
            directories: directories,
            algorithm: algorithmInput.value,
            hash_size: parseInt(hashSizeInput.value, 10),
            workers: workersInput.value ? parseInt(workersInput.value, 10) : null,
            enable_sharpness_check: enableSharpnessCheck.checked,
        };

        stopRequested = false; // Reset stop flag for new scan
        btnStartScan.disabled = true;
        btnGoReview.disabled = true; // Disable review button until scan is ready
        btnStopScan.disabled = false; // Enable stop button
        btnStopScan.textContent = 'Stop Scan'; // Reset button text
        btnStopScan.classList.remove('opacity-75', 'cursor-not-allowed'); // Reset styling
        btnStopScan.style.display = 'inline-flex'; // Show stop button
        scanStatusEl.textContent = 'Starting scan... Please wait.';
        scanProgress.style.display = 'block';
        scanProgressFill.style.width = '0%'; // Reset to 0
        scanProgressText.textContent = '0%';
        scanProgressFill.classList.add('transition-all', 'duration-500', 'ease-out'); // Add transition for smoother animation

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();

                // Create enhanced error with parsed data
                const error = new Error(errorData.detail || 'Failed to start scan');
                error.validationErrors = parseValidationErrors(errorData);
                error.errorData = errorData;
                throw error;
            }

            const data = await response.json();
            currentJobId = data.job_id;

            // Clear any previous validation errors on success
            dirValidationState.clear();
            directories.forEach(dir => dirValidationState.set(dir, true));
            renderDirs();
            hideValidationError();

            pollStatus(currentJobId);

        } catch (error) {
            btnStartScan.disabled = false; // Always re-enable start scan button
            scanProgress.style.display = 'none'; // Hide progress bar

            // Handle validation errors
            if (error.validationErrors && error.validationErrors.length > 0) {
                // Mark invalid paths
                error.validationErrors.forEach(path => {
                    dirValidationState.set(path, false);
                });

                // Mark paths that weren't in the error as valid
                directories.forEach(dir => {
                    if (!dirValidationState.has(dir) || dirValidationState.get(dir) === undefined) {
                        dirValidationState.set(dir, true);
                    }
                });

                // Re-render directory list with validation indicators
                renderDirs();

                // Show prominent error alert
                showValidationError(error.validationErrors);

                // Update status text
                const pathCount = error.validationErrors.length;
                const statusMessage = `${pathCount} ${pathCount === 1 ? 'directory' : 'directories'} not found.`;
                scanStatusEl.textContent = statusMessage;
                scanStatusEl.classList.add('text-red-400', 'font-semibold');
            } else {
                // Generic error (not validation-related)
                let errorMessage = error.message || 'Error starting scan.';
                scanStatusEl.textContent = errorMessage;
                scanStatusEl.classList.add('text-red-400');
            }

            // If previous job available, allow review
            if (initialGoReviewEnabled) {
                btnGoReview.disabled = false;
                scanStatusEl.textContent += ` You can still ${initialScanStatusMessage.toLowerCase()}.`;
            }
        }
    }

    async function pollStatus(jobId) {
        try {
            const response = await fetch(`/api/scan/${jobId}`);
            if (!response.ok) {
                throw new Error('Could not fetch scan status.');
            }
            const data = await response.json();

            // Calculate a more meaningful progress if possible, otherwise use simulation
            let progress = data.progress_percent !== undefined ? data.progress_percent : 0;
            if (data.status === 'pending') {
                progress = 5;
            } else if (data.status === 'running' && data.progress_percent === undefined) {
                // Fallback for simple progress simulation if backend doesn't send progress_percent
                progress = 20 + Math.min(data.groups / 100 * 50, 75); // rough estimate
            } else if (data.status === 'succeeded' || data.status === 'failed' || data.status === 'cancelled') {
                progress = 100;
            }
            
            scanProgressFill.style.width = `${progress}%`;
            scanProgressText.textContent = `${Math.round(progress)}%`;

            // Don't overwrite "Requesting scan stop..." message while waiting for cancellation
            if (!stopRequested) {
                let statusMessage = `Status: ${data.status}`;
                if (data.status === 'running') {
                    statusMessage += ` | Images Hashed: ${data.hashed_images || 0}/${data.total_images || '?'}`;
                }
                if (data.groups !== undefined) {
                    statusMessage += ` | Groups Found: ${data.groups}`;
                }
                scanStatusEl.textContent = statusMessage;
            }


            if (data.status === 'running' || data.status === 'pending') {
                setTimeout(() => pollStatus(jobId), 2000); // Poll every 2 seconds
            } else if (data.status === 'succeeded') {
                stopRequested = false; // Reset flag

                // Only save as lastSuccessfulJobId if it has groups
                if (data.groups > 0) {
                    lastSuccessfulJobId = currentJobId;
                    scanStatusEl.textContent = `Scan complete! Found ${data.groups} groups. Ready for review.`;
                    btnGoReview.disabled = false;
                    updateGoReviewVisibility(); // Show Go to Review button
                } else {
                    // Scan succeeded but found no duplicates
                    // Restore to last successful scan if one exists (don't overwrite it!)
                    if (lastSuccessfulJobId) {
                        currentJobId = lastSuccessfulJobId;
                        btnGoReview.disabled = false;
                        updateGoReviewVisibility();
                        scanStatusEl.textContent = 'Scan complete! No duplicates found. Previous results still available.';
                    } else {
                        currentJobId = null;
                        btnGoReview.disabled = true;
                        btnGoReview.style.display = 'none';
                        scanStatusEl.textContent = 'Scan complete! No duplicates found.';
                    }
                    showNoDuplicatesAlert(); // Show prominent alert
                }

                btnStartScan.disabled = false;
                btnStopScan.style.display = 'none'; // Hide stop button
                scanProgressFill.classList.remove('transition-all'); // Remove transition after completion
            } else if (data.status === 'cancelled') {
                stopRequested = false; // Reset flag
                hideStoppingScanAlert(); // Hide stopping alert
                scanProgress.style.display = 'none';
                btnStartScan.disabled = false;
                btnStopScan.style.display = 'none'; // Hide stop button

                // Only restore if lastSuccessfulJobId exists AND has groups
                if (lastSuccessfulJobId) {
                    currentJobId = lastSuccessfulJobId;
                    btnGoReview.disabled = false;
                    updateGoReviewVisibility(); // Show Go to Review button for last successful scan
                    scanStatusEl.textContent = 'Scan cancelled. Previous results available.';
                } else {
                    currentJobId = null;
                    btnGoReview.disabled = true;
                    btnGoReview.style.display = 'none';
                    scanStatusEl.textContent = 'Scan cancelled.';
                }

                scanProgressFill.classList.remove('transition-all'); // Remove transition
            } else { // failed
                stopRequested = false; // Reset flag
                hideStoppingScanAlert(); // Hide stopping alert
                btnStartScan.disabled = false;
                btnStopScan.style.display = 'none'; // Hide stop button

                // Only restore if lastSuccessfulJobId exists AND has groups
                if (lastSuccessfulJobId) {
                    currentJobId = lastSuccessfulJobId;
                    btnGoReview.disabled = false;
                    updateGoReviewVisibility();
                    scanStatusEl.textContent = `Scan failed. Previous results available.`;
                } else {
                    currentJobId = null;
                    btnGoReview.disabled = true;
                    btnGoReview.style.display = 'none';
                    scanStatusEl.textContent = `Scan failed: ${data.message}`;
                }

                scanProgressFill.classList.remove('transition-all'); // Remove transition on error
            }
        } catch (error) {
            stopRequested = false; // Reset flag
            hideStoppingScanAlert(); // Hide stopping alert
            scanStatusEl.textContent = `Error polling: ${error.message}`;
            btnStartScan.disabled = false;
            btnStopScan.style.display = 'none'; // Hide stop button

            // Restore last successful scan if available
            if (lastSuccessfulJobId) {
                currentJobId = lastSuccessfulJobId;
                btnGoReview.disabled = false;
                updateGoReviewVisibility(); // Show Go to Review button for last successful scan
            } else {
                btnGoReview.disabled = true;
                btnGoReview.style.display = 'none';
            }

            scanProgressFill.classList.remove('transition-all'); // Remove transition on error
        }
    }

    function showScanSetupScreen() {
        screenReview.style.display = 'none';
        screenScanSetup.style.display = 'block';
        document.querySelector('header').style.display = 'block'; // Show header on Scan Setup
    }

    function showReviewScreen() {
        screenScanSetup.style.display = 'none';
        screenReview.style.display = 'block';
        document.querySelector('header').style.display = 'none'; // Hide header on Review
        loadGroups();
    }

    async function loadGroups() {
        if (!currentJobId) return;
        const response = await fetch(`/api/groups?job_id=${currentJobId}`);
        if(response.ok) {
            const data = await response.json();
            allGroups = data.groups; // Store all fetched groups
            currentJobDirectories = data.directories || []; // Store job directories for finalize modal
            decisions = new Map(); // Reset decisions
            visitedGroups = new Set(); // Reset visited groups

            allGroups.forEach(group => { // Iterate over allGroups to initialize decisions
                const keptSet = new Set();
                if (group.suggested) {
                    keptSet.add(group.suggested); // Keep suggested by default
                } else if (group.files.length > 0) {
                    keptSet.add(group.files[0]); // Fallback to first if no suggested
                }
                decisions.set(group.id, keptSet);
            });

            // After loading and initializing decisions, apply filter and sort
            filterAndSortGroups(); // This will populate currentGroups and call renderGroupList()

            if (currentGroups.length > 0) { // Select first group from filtered/sorted list
                selectedGroup = currentGroups[0];
                selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
            } else {
                selectedGroup = null;
                selectedImage = null;
            }
            // renderGroupList() is called by filterAndSortGroups()
            renderSelectedGroup();
            updatePendingActions();
            updateGroupNavigationButtons(); // Call here
        } else {
            alert('Could not load groups.');
        }
    }

    function renderGroupList() {
        groupListEl.innerHTML = '';
        currentGroups.forEach(group => { // Iterate over currentGroups (filtered/sorted)
            const div = document.createElement('div');
            const keptPaths = decisions.get(group.id) || new Set();
            const keptCount = keptPaths.size;
            const deletedCount = group.files.length - keptCount;
            
            let statusText = `Kept: ${keptCount}, Deleted: ${deletedCount}`;
            const decisionStatus = getGroupDecisionStatus(group); // Use helper for status
            if (decisionStatus === 'deleted') {
                statusText = `<span class="text-[#c967a2]">All Deleted</span>`;
            } else if (decisionStatus === 'kept') {
                statusText = `<span class="text-[#9c539c]">All Kept</span>`;
            } else if (decisionStatus === 'mixed') {
                statusText = `<span class="text-teal-400">Mixed</span>`;
            }


            const thumbnailUrl = group.suggested ? `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(group.suggested)}&max_size=64` : '';
            const isGroupSuggested = group.suggested;

            div.innerHTML = `
                <div class="flex items-center space-x-2">
                    ${thumbnailUrl ? `<img src="${thumbnailUrl}" class="w-8 h-8 object-cover rounded" alt="Thumbnail">` : ''}
                    <div class="flex-grow">
                        <div class="flex items-center space-x-2">
                            <span>Group ${group.id} (${group.files.length} images)</span>
                            ${visitedGroups.has(group.id) ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[#9c539c]" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>` : ''}
                        </div>
                        <div class="text-sm text-gray-400 flex items-center space-x-1">
                            <span class="decision-tag ${decisionStatus === 'deleted' ? 'bg-red-600' : 'bg-green-600'} text-white px-2 py-0.5 rounded-full text-xs">
                                ${decisionStatus === 'deleted' ? 'Deleted' : 'Kept'}
                            </span>
                            ${isGroupSuggested ? '<span class="suggested-dot bg-teal-500 rounded-full w-2 h-2"></span>' : ''}
                        </div>
                    </div>
                </div>
            `;
            div.className = 'p-3 rounded-md cursor-pointer hover:bg-gray-800';

            if (selectedGroup && group.id === selectedGroup.id) {
                div.classList.add('bg-gray-700', 'text-white');
            }
            div.onclick = () => {
                selectedGroup = group;
                selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
                visitedGroups.add(group.id);
                renderGroupList();
                renderSelectedGroup();
            };
            groupListEl.appendChild(div);
        });
        updateGroupNavigationButtons(); // Call here
    }

    function renderSelectedGroup() {
        const heroImageContainer = document.getElementById('heroImageContainer'); // Get container reference
        const heroMetadataBar = document.getElementById('heroMetadataBar'); // NEW: Get metadata bar reference
        heroImageContainer.innerHTML = ''; // Clear existing content
        heroMetadataBar.innerHTML = ''; // NEW: Clear metadata bar

        if (!selectedGroup) {
            heroImageContainer.innerHTML = '<div class="text-center text-gray-400">No group selected.</div>';
            return;
        }

        const keptPaths = decisions.get(selectedGroup.id) || new Set();
        const isSelectedImageKept = keptPaths.has(selectedImage);
        const isSuggested = selectedImage === selectedGroup.suggested;



        // Add suggested dot for hero image if applicable
        if (selectedImage === selectedGroup.suggested) {
            const suggestedDot = document.createElement('span');
            suggestedDot.className = 'suggested-dot hero-dot bg-teal-500 rounded-full w-3 h-3 absolute top-2 right-2'; // Position as needed
            heroImageContainer.appendChild(suggestedDot);
        }

        const heroTextEl = document.createElement('div');
        heroTextEl.className = 'hero-text'; // NEW: Use hero-text class for metadata bar styling

        // Determine if side-by-side view is possible
        const canUseSideBySide = selectedGroup.files.length >= 2 && selectedGroup.files.length <= 3;
        sideBySideToggle.disabled = !canUseSideBySide;
        // The toggle's 'checked' state should reflect if side-by-side is both enabled and currently applicable
        sideBySideToggle.checked = isSideBySideView && canUseSideBySide;


        if (isSideBySideView && canUseSideBySide) {
            const sideBySideDiv = document.createElement('div');
            sideBySideDiv.className = `flex justify-center items-center space-x-4 h-full max-h-[60vh] 
                                       ${selectedGroup.files.length === 2 ? 'side-by-side-grid-2' : ''}
                                       ${selectedGroup.files.length === 3 ? 'side-by-side-grid-3' : ''}`; // Apply grid class

            selectedGroup.files.forEach(file => {
                const isCurrentFileSelected = (file === selectedImage);
                const isCurrentFileSuggested = (file === selectedGroup.suggested);
                
                const imgContainer = document.createElement('div');
                // Use custom class for styling and flex properties
                imgContainer.className = 'side-by-side-img-container flex flex-col items-center h-full p-2 rounded-md bg-black border border-gray-700';

                const img = document.createElement('img');
                img.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(file)}&max_size=1024`;
                img.alt = file;
                img.className = 'w-full h-full object-contain rounded-md bg-transparent'; // object-contain for vertical fitting

                const imgLabel = document.createElement('div');
                let labelText = file.split('/').pop(); // Display just the filename
                if (isCurrentFileSelected) {
                    labelText = `(Selected) ${labelText}`;
                    imgLabel.classList.add('text-teal-400', 'font-bold');
                }
                if (isCurrentFileSuggested) {
                    labelText = `(Suggested) ${labelText}`;
                    imgLabel.classList.add('text-teal-400', 'font-bold');
                }
                imgLabel.textContent = labelText;
                imgLabel.className += ' text-sm text-gray-400 mt-2 overflow-hidden whitespace-nowrap overflow-ellipsis max-w-full';


                imgContainer.appendChild(img);
                imgContainer.appendChild(imgLabel);
                sideBySideDiv.appendChild(imgContainer);
            });

            heroImageContainer.appendChild(sideBySideDiv);
            // Update metadata for side-by-side view
            heroTextEl.innerHTML = 'Side-by-side comparison view';
            heroTextEl.className = 'hero-text text-center text-gray-500 italic';
        } else {
            // Existing single image view logic
            const img = document.createElement('img');
            img.id = 'heroImg';
            img.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(selectedImage)}&max_size=1024`;
            img.alt = 'Selected image';
            // CHANGED: Removed 'h-full' to allow proper flex behavior
            img.className = 'max-w-full max-h-full object-contain rounded-md bg-transparent';
            heroImageContainer.appendChild(img);

            let heroText = selectedImage;
            const imageStats = selectedGroup.stats[selectedImage];
            if (imageStats) {
                heroText += ` | ${imageStats.width}x${imageStats.height} | ${imageStats.size}`;
            }
            heroTextEl.innerHTML = heroText;
        }
        // NEW: Append text to dedicated metadata bar instead of image container
        heroMetadataBar.appendChild(heroTextEl);
        
        thumbRow.innerHTML = '';
        selectedGroup.files.forEach(file => {
            const thumbContainer = document.createElement('div');
            thumbContainer.className = 'flex flex-col items-center space-y-1 mx-2 py-3'; // Container for image and tag

            const img = document.createElement('img');
            img.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(file)}&max_size=128`;
            img.className = 'h-24 w-24 object-cover rounded-md cursor-pointer border-2 transition-all duration-200';
            
            const isThumbKept = keptPaths.has(file);
            const isThumbSuggested = file === selectedGroup.suggested;

            let tagText = isThumbKept ? 'Kept' : 'Deleted';
            let tagClass = `text-xs px-1 rounded ${isThumbKept ? 'bg-green-600' : 'bg-red-600'} text-white flex items-center space-x-1`;

            if (isThumbKept) {
                img.classList.add('border-teal-500');
            } else {
                img.classList.add('border-gray-500', 'opacity-50');
            }

            if (file === selectedImage) {
                img.classList.add('!border-teal-400', '!opacity-100', '!transform', '!scale-105', '!shadow-lg', '!ring-2', '!ring-gray-500'); // Override
            }
            img.onclick = (event) => {
                event.stopPropagation(); // Prevent event from bubbling up to thumbContainer
                openImagePreview(file);
            };
            
            thumbContainer.appendChild(img);
            // Always show the tag based on decision
            const tag = document.createElement('div');
            tag.className = tagClass;
            tag.innerHTML = `<span>${tagText}</span>${isThumbSuggested ? '<span class="suggested-dot bg-teal-500 rounded-full w-2 h-2"></span>' : ''}`;
            thumbContainer.appendChild(tag);

            // Add an additional click handler to thumbContainer for selection, distinct from preview
            thumbContainer.addEventListener('click', () => {
                selectedImage = file;
                renderSelectedGroup(); // This will call updateToggleButtonText()
            });

            thumbRow.appendChild(thumbContainer);
        });
        updateGroupNavigationButtons(); // Call here
        updateToggleButtonText(); // Update toggle button text based on selected image state
    }

    function toggleKeepSelected() {
        if (!selectedGroup || !selectedImage) return;
        visitedGroups.add(selectedGroup.id);

        const keptPaths = decisions.get(selectedGroup.id);
        if (keptPaths.has(selectedImage)) {
            keptPaths.delete(selectedImage);
        } else {
            keptPaths.add(selectedImage);
        }
        decisions.set(selectedGroup.id, keptPaths);
        updatePendingActions();
        renderGroupList();
        renderSelectedGroup(); // Re-render to update visual indicators
        updateToggleButtonText(); // Update button text to reflect new state
    }

    function keepAll() {
        if (!selectedGroup) return;
        visitedGroups.add(selectedGroup.id);

        const keptPaths = new Set(selectedGroup.files);
        decisions.set(selectedGroup.id, keptPaths);
        updatePendingActions();
        renderGroupList();
        renderSelectedGroup();
        // Auto-advance
        advanceToNextGroup();
    }

    function deleteAll() {
        if (!selectedGroup) return;
        visitedGroups.add(selectedGroup.id);

        decisions.set(selectedGroup.id, new Set()); // Clear kept paths
        updatePendingActions();
        renderGroupList();
        renderSelectedGroup();
        // Auto-advance
        advanceToNextGroup();
    }

    function trashNonSuggested() {
        if (!selectedGroup) return;
        visitedGroups.add(selectedGroup.id);

        const keptPaths = new Set();
        if (selectedGroup.suggested) {
            keptPaths.add(selectedGroup.suggested);
        }
        decisions.set(selectedGroup.id, keptPaths);
        updatePendingActions();
        renderGroupList();
        renderSelectedGroup();
        // Auto-advance
        advanceToNextGroup();
    }

    function keepThisAndDeleteOthers() {
        if (!selectedGroup || !selectedImage) return;
        visitedGroups.add(selectedGroup.id);

        const keptPaths = new Set();
        keptPaths.add(selectedImage); // Keep only the selected image

        decisions.set(selectedGroup.id, keptPaths);
        updatePendingActions();
        renderGroupList();
        renderSelectedGroup();
        // Auto-advance
        advanceToNextGroup();
    }


    function advanceToPreviousGroup() {
        if (!selectedGroup || currentGroups.length === 0) return;
        let currentIndex = currentGroups.findIndex(g => g.id === selectedGroup.id);

        if (currentIndex <= 0) { // Already at the first group or selectedGroup not found, go to first if not already
             if (currentGroups.length > 0 && selectedGroup.id !== currentGroups[0].id) {
                selectedGroup = currentGroups[0];
                selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
                renderGroupList();
                renderSelectedGroup();
             }
            return;
        }

        selectedGroup = currentGroups[currentIndex - 1];
        const newKeptPaths = decisions.get(selectedGroup.id) || new Set();
        selectedImage = Array.from(newKeptPaths)[0] || selectedGroup.files[0];
        renderGroupList();
        renderSelectedGroup();
        updateGroupNavigationButtons();
    }

    function advanceToNextGroup() {
        if (!selectedGroup || currentGroups.length === 0) return;
        let currentIndex = currentGroups.findIndex(g => g.id === selectedGroup.id);

        if (currentIndex === -1 || currentIndex >= currentGroups.length - 1) { // SelectedGroup not found OR already at last group
            if (currentIndex === currentGroups.length - 1) { // Exactly at last group
                alert("All groups reviewed!");
            } else if (currentGroups.length > 0 && selectedGroup.id !== currentGroups[0].id) { // Not found or no group selected, jump to first
                selectedGroup = currentGroups[0];
                selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
                renderGroupList();
                renderSelectedGroup();
            }
            return;
        }

        selectedGroup = currentGroups[currentIndex + 1];
        const newKeptPaths = decisions.get(selectedGroup.id) || new Set();
        selectedImage = Array.from(newKeptPaths)[0] || selectedGroup.files[0];
        renderGroupList();
        renderSelectedGroup();
        updateGroupNavigationButtons();
    }

    function updateGroupNavigationButtons() {
        const currentIndex = currentGroups.findIndex(g => g.id === selectedGroup?.id);
        btnPrevGroup.disabled = currentIndex <= 0;
        btnNextGroup.disabled = currentIndex === -1 || currentIndex >= currentGroups.length - 1;
    }
    
    function updatePendingActions() {
        const decidedCount = Array.from(decisions.keys()).filter(id => visitedGroups.has(id)).length;
        pendingText.textContent = `${decidedCount} groups decided`;
    }

    async function applyFinalizeActions() {
        // Get selected action
        const selectedAction = document.querySelector('input[name="finalizeAction"]:checked').value;

        // Get trash destination
        const trashDestination = document.querySelector('input[name="trashDestination"]:checked').value;
        const customTrashPath = document.getElementById('customTrashPath').value.trim();
        const trashDir = trashDestination === 'custom' && customTrashPath ? customTrashPath : null;

        // Validate primary directory if needed
        if (selectedAction === 'keep_primary') {
            const primaryDir = document.getElementById('primaryDirDropdown').value;
            if (!primaryDir) {
                alert('Please select a primary directory.');
                return;
            }
        }

        try {
            let toTrash = [];

            // Build trash list based on selected action
            if (selectedAction === 'apply_decisions') {
                // Keep user decisions, suggested for unreviewed
                for (const group of currentGroups) {
                    const kept = decisions.get(group.id) || new Set();
                    if (kept.size === 0) {
                        // Unreviewed: keep suggested, trash others
                        toTrash.push(...group.files.filter(f => f !== group.suggested));
                    } else {
                        // Reviewed: trash non-kept files
                        toTrash.push(...group.files.filter(f => !kept.has(f)));
                    }
                }

            } else if (selectedAction === 'keep_suggested') {
                // Keep only suggested, disregard user decisions
                for (const group of currentGroups) {
                    toTrash.push(...group.files.filter(f => f !== group.suggested));
                }

            } else if (selectedAction === 'keep_primary') {
                // Keep primary directory files (with user overrides for reviewed)
                const primaryDir = document.getElementById('primaryDirDropdown').value;

                // Use backend endpoint for this
                const payload = {
                    job_id: currentJobId,
                    primary_dir: primaryDir,
                    destination: trashDir,
                    recreate_paths: false
                };

                const response = await fetch('/api/actions/trash-non-primary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to trash files');
                }

                finalizeModal.style.display = 'none';
                alert(`Files moved to trash successfully.`);
                loadGroups();
                visitedGroups.clear();
                return;
            }

            // For apply_decisions and keep_suggested, use standard trash endpoint
            if (toTrash.length === 0) {
                finalizeModal.style.display = 'none';
                alert('No files to trash.');
                return;
            }

            const payload = {
                job_id: currentJobId,
                paths: toTrash,
                destination: trashDir,
                recreate_paths: false
            };

            const response = await fetch('/api/actions/trash', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Failed to move files to trash');
            }

            finalizeModal.style.display = 'none';
            alert(`${toTrash.length} files moved to trash.`);
            loadGroups();
            visitedGroups.clear();

        } catch (error) {
            finalizeModal.style.display = 'none';
            alert(`Failed to move files to trash: ${error.message}`);
        }
    }

    function finalizePrompt() {
        const unreviewedCount = currentGroups.length - visitedGroups.size;
        const reviewedCount = visitedGroups.size;

        // Update message
        if (reviewedCount > 0) {
            finalizeMessage.textContent = `You have reviewed ${reviewedCount} out of ${currentGroups.length} groups.`;
        } else {
            finalizeMessage.textContent = `You haven't reviewed any groups yet.`;
        }

        // Show warning if unreviewed
        if (unreviewedCount > 0) {
            unreviewedWarning.style.display = 'block';
            finalizeMessage.textContent += ` ${unreviewedCount} groups remain unreviewed.`;
        } else {
            unreviewedWarning.style.display = 'none';
        }

        // Show/hide primary directory option based on directory count
        const primaryDirOption = document.getElementById('primaryDirOption');
        if (currentJobDirectories.length > 1) {
            primaryDirOption.style.display = 'flex';

            // Populate primary directory dropdown
            const dropdown = document.getElementById('primaryDirDropdown');
            dropdown.innerHTML = '<option value="">-- Select Directory --</option>';
            currentJobDirectories.forEach(dir => {
                const option = document.createElement('option');
                option.value = dir;
                option.textContent = dir;
                dropdown.appendChild(option);
            });
        } else {
            primaryDirOption.style.display = 'none';
        }

        // Reset form to defaults
        document.getElementById('trashSystem').checked = true;
        document.querySelector('input[name="finalizeAction"][value="apply_decisions"]').checked = true;
        document.getElementById('customTrashPath').disabled = true;
        document.getElementById('customTrashPath').value = '';
        document.getElementById('primaryDirControls').style.display = 'none';

        finalizeModal.style.display = 'flex';
    }

    // Handle trash destination radio change
    document.querySelectorAll('input[name="trashDestination"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const customPathInput = document.getElementById('customTrashPath');
            if (e.target.value === 'custom') {
                customPathInput.disabled = false;
                customPathInput.focus();
            } else {
                customPathInput.disabled = true;
                customPathInput.value = '';
            }
        });
    });

    // Handle action radio change - show/hide primary controls
    document.querySelectorAll('input[name="finalizeAction"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const primaryControls = document.getElementById('primaryDirControls');
            if (e.target.value === 'keep_primary') {
                primaryControls.style.display = 'block';
            } else {
                primaryControls.style.display = 'none';
            }
        });
    });


    // --- Event Listeners ---
    btnAddDir.addEventListener('click', addDirectory);
    dirInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addDirectory();
        }
    });
    btnRemoveDir.addEventListener('click', removeDirectory);
    btnStartScan.addEventListener('click', startScan);
    btnStopScan.addEventListener('click', async () => {
        if (!currentJobId) return;

        stopRequested = true; // Mark that stop was requested
        showStoppingScanAlert(); // Show prominent alert
        btnStopScan.disabled = true;
        btnStopScan.textContent = 'Stopping...'; // Change button text
        btnStopScan.classList.add('opacity-75', 'cursor-not-allowed'); // Visual feedback
        scanStatusEl.textContent = 'Requesting scan stop...';

        try {
            const response = await fetch(`/api/scan/${currentJobId}/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                const errorData = await response.json();
                hideStoppingScanAlert(); // Hide alert on error
                alert(`Failed to stop scan: ${errorData.detail}`);
                btnStopScan.disabled = false;
                btnStopScan.textContent = 'Stop Scan'; // Restore button text
                btnStopScan.classList.remove('opacity-75', 'cursor-not-allowed');
                stopRequested = false; // Reset flag on failure
            }
            // Polling will detect the "cancelled" status and update UI automatically
        } catch (error) {
            hideStoppingScanAlert(); // Hide alert on error
            alert(`Error stopping scan: ${error.message}`);
            btnStopScan.disabled = false;
            btnStopScan.textContent = 'Stop Scan'; // Restore button text
            btnStopScan.classList.remove('opacity-75', 'cursor-not-allowed');
            stopRequested = false; // Reset flag on error
        }
    });
    btnGoReview.addEventListener('click', () => {
        if(currentJobId) {
            showReviewScreen();
        } else {
            alert("Please run a scan first.");
        }
    });

    // Dismiss validation error alert
    const dismissValidationError = document.getElementById('dismissValidationError');
    if (dismissValidationError) {
        dismissValidationError.addEventListener('click', hideValidationError);
    }

    // Dismiss no duplicates alert
    const dismissNoDuplicatesAlert = document.getElementById('dismissNoDuplicatesAlert');
    if (dismissNoDuplicatesAlert) {
        dismissNoDuplicatesAlert.addEventListener('click', hideNoDuplicatesAlert);
    }

    btnBackToScanSetup.addEventListener('click', showScanSetupScreen);

    sideBySideToggle.addEventListener('change', (e) => {
        isSideBySideView = e.target.checked;
        renderSelectedGroup(); // Re-render the group to apply the new view mode
    });

    btnPrevGroup.addEventListener('click', advanceToPreviousGroup);
    btnNextGroup.addEventListener('click', advanceToNextGroup);

    groupFilter.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        filterAndSortGroups();
    });

    groupSort.addEventListener('change', (e) => {
        currentSortBy = e.target.value;
        filterAndSortGroups();
    });

    groupSortDirection.addEventListener('click', () => {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
        // Update the arrow icon visually
        const iconPath = groupSortDirection.querySelector('path');
        if (iconPath) {
            iconPath.setAttribute('d', currentSortDirection === 'asc' ? 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12' : 'M3 20h13M3 16h9m-9-4h6m4 0l4 4m0 0l4-4m-4 4V4');
        }
        filterAndSortGroups();
    });

    // Shortcuts Modal
    btnShortcuts.addEventListener('click', () => {
        shortcutsModal.style.display = 'flex';
    });

    btnShortcutsClose.addEventListener('click', () => {
        shortcutsModal.style.display = 'none';
    });

    shortcutsModal.addEventListener('click', (e) => {
        if (e.target === shortcutsModal) {
            shortcutsModal.style.display = 'none';
        }
    });

    // Review screen actions
    actToggleKeep.addEventListener('click', toggleKeepSelected);
    actKeepAll.addEventListener('click', keepAll);
    actDeleteAll.addEventListener('click', deleteAll);
    actTrashNonSuggested.addEventListener('click', trashNonSuggested);

    btnFinalize.addEventListener('click', finalizePrompt);

    // Finalize modal buttons
    optCancelFinalize.addEventListener('click', () => {
        finalizeModal.style.display = 'none';
    });

    optContinueReview.addEventListener('click', () => {
        finalizeModal.style.display = 'none';
    });

    optApplyDecision.addEventListener('click', applyFinalizeActions);

    // Keyboard shortcuts for finalize modal
    window.addEventListener('keydown', (e) => {
        // Only handle if finalize modal is visible
        if (finalizeModal.style.display !== 'flex') return;

        switch(e.key) {
            case 'Enter':
                // Primary action on Enter (Apply Decision)
                document.getElementById('optApplyDecision').click();
                e.preventDefault();
                break;
            case 'Escape':
                // Cancel on Escape (Continue Reviewing)
                document.getElementById('optContinueReview').click();
                e.preventDefault();
                break;
        }
    });

    window.addEventListener('keydown', (e) => {
        if (screenReview.style.display !== 'block') return;

        let handled = false;
        
        // Handle Escape key for open modals
        if (e.key === 'Escape') {
            if (shortcutsModal.style.display === 'flex') { // Prioritize shortcuts modal
                shortcutsModal.style.display = 'none';
                handled = true;
            } else if (imagePreviewModal.style.display === 'flex') {
                closeImagePreview();
                handled = true;
            } else if (isMagnifyMode) { // Check if magnify mode is active
                closeMagnifiedImage();
                handled = true;
            }
        }
        
        // Handle Magnify Mode interactions
        if (isMagnifyMode) {
            switch (e.key) {
                case 'ArrowLeft':
                    if (selectedGroup && magnifiedImageIndex > 0) {
                        magnifiedImageIndex--;
                        magnifiedImagePath = selectedGroup.files[magnifiedImageIndex];
                        selectedImage = magnifiedImagePath;
                        originalImageSrc.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(magnifiedImagePath)}&max_size=2048`; // Use thumbnail as fallback
                        let indexText = `${magnifiedImageIndex + 1}/${selectedGroup.files.length}`;
                        if (magnifiedImagePath === selectedGroup.suggested) {
                            magnifiedImageIndexDisplay.innerHTML = `${indexText} <span class="suggested-dot bg-teal-500 rounded-full w-2 h-2 ml-1 inline-block"></span>`;
                        } else {
                            magnifiedImageIndexDisplay.textContent = indexText;
                        }
                    }
                    handled = true;
                    break;
                case 'ArrowRight':
                    if (selectedGroup && magnifiedImageIndex < selectedGroup.files.length - 1) {
                        magnifiedImageIndex++;
                        magnifiedImagePath = selectedGroup.files[magnifiedImageIndex];
                        selectedImage = magnifiedImagePath;
                        originalImageSrc.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(magnifiedImagePath)}&max_size=2048`; // Use thumbnail as fallback
                        let indexText = `${magnifiedImageIndex + 1}/${selectedGroup.files.length}`;
                        if (magnifiedImagePath === selectedGroup.suggested) {
                            magnifiedImageIndexDisplay.innerHTML = `${indexText} <span class="suggested-dot bg-teal-500 rounded-full w-2 h-2 ml-1 inline-block"></span>`;
                        } else {
                            magnifiedImageIndexDisplay.textContent = indexText;
                        }
                    }
                    handled = true;
                    break;
            }
            if (handled) {
                e.preventDefault();
            }
            return; // Don't process other shortcuts if in magnified mode
        }

        // General keyboard shortcuts (only apply if not in magnify mode)
        switch (e.key) {
            case 'ArrowUp':
                advanceToPreviousGroup();
                handled = true;
                break;
            case 'ArrowDown':
                advanceToNextGroup();
                handled = true;
                break;
            case 'ArrowLeft': // This is for main screen navigation, not magnify
                if (selectedGroup) {
                    const files = selectedGroup.files;
                    const currentImageIndex = files.indexOf(selectedImage);
                    if (currentImageIndex > 0) {
                        selectedImage = files[currentImageIndex - 1];
                        renderSelectedGroup();
                    }
                }
                handled = true;
                break;
            case 'ArrowRight': // This is for main screen navigation, not magnify
                if (selectedGroup) {
                    const files = selectedGroup.files;
                    const currentImageIndex = files.indexOf(selectedImage);
                    if (currentImageIndex < files.length - 1) {
                        selectedImage = files[currentImageIndex + 1];
                        renderSelectedGroup();
                    }
                }
                handled = true;
                break;
            case 'z': // Magnify Mode Toggle (keydown)
                if (!isMagnifyMode && selectedImage) { // Only enter magnify mode if not already in it
                    isMagnifyMode = true;
                    openMagnifiedImage(selectedImage);
                }
                handled = true;
                break;
            case 'k': // Toggle Keep
                toggleKeepSelected();
                handled = true;
                break;
            case 'd': // Delete All
                deleteAll();
                handled = true;
                break;
            case 'o': // Trash Non-Suggested
                trashNonSuggested();
                handled = true;
                break;
            case 'p': // Keep This and Delete Others (Primary Keep)
                keepThisAndDeleteOthers();
                handled = true;
                break;

        }

        if (handled) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (screenReview.style.display !== 'block') return;

        let handled = false;
        switch (e.key) {
            case 'z': // Exit Magnify Mode (keyup)
                if (isMagnifyMode) {
                    isMagnifyMode = false;
                    closeMagnifiedImage();
                    renderSelectedGroup(); // Add this line
                }
                handled = true;
                break;
        }

        if (handled) {
            e.preventDefault();
        }
    });

    // --- Initial Render ---
    renderDirs();

    // Check for previous job on load
    loadLatestJob().then(job => {
        if (job.job_id && job.status === 'succeeded' && job.groups > 0) {
            // Backend returned a reviewable job
            currentJobId = job.job_id;
            lastSuccessfulJobId = job.job_id;
            btnGoReview.disabled = false;
            scanStatusEl.textContent = `Last scan found ${job.groups} group${job.groups > 1 ? 's' : ''}. Click 'Go to Review'.`;
        } else if (job.job_id && job.status === 'running') {
            // Scan is still running
            currentJobId = job.job_id;
            btnGoReview.disabled = true;
            scanStatusEl.textContent = 'Scan in progress... (refresh to see results)';
        } else if (job.status === 'succeeded' && job.groups === 0) {
            // Most recent scan found no duplicates (no reviewable jobs exist)
            currentJobId = null;
            btnGoReview.disabled = true;
            scanStatusEl.textContent = 'Last scan found no duplicates.';
        } else {
            // No previous job
            currentJobId = null;
            btnGoReview.disabled = true;
            scanStatusEl.textContent = '';
        }

        // Capture initial state
        initialGoReviewEnabled = !btnGoReview.disabled;
        initialScanStatusMessage = scanStatusEl.textContent;

        // Update button visibility
        updateRemoveButtonVisibility();
        updateGoReviewVisibility();
        updateStartScanButton();
    });
});