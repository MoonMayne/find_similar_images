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
    const primaryDirInput = document.getElementById('primaryDir');
    const algorithmInput = document.getElementById('algorithm');
    const hashSizeInput = document.getElementById('hashSize');
    const btnStartScan = document.getElementById('btnStartScan');
    const btnGoReview = document.getElementById('btnGoReview');
    const scanStatusEl = document.getElementById('scanStatus');
    const scanProgress = document.getElementById('scanProgress');
    const scanProgressFill = document.getElementById('scanProgressFill');
    const scanProgressText = document.getElementById('scanProgressText'); // New DOM element
    const workersInput = document.getElementById('workers');
    const trashDirInput = document.getElementById('trashDir');

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
    const btnCancelFinalize = document.getElementById('btnCancelFinalize');
    const unreviewedWarning = document.getElementById('unreviewedWarning');
    const optContinueReview = document.getElementById('optContinueReview');
    const optKeepSuggested = document.getElementById('optKeepSuggested');
    const optKeepPrimary = document.getElementById('optKeepPrimary');
    const optApplyTrash = document.getElementById('optApplyTrash');

    // Image Preview Modal Elements
    const imagePreviewModal = document.getElementById('imagePreviewModal');
    const imagePreviewSrc = document.getElementById('imagePreviewSrc');
    const imagePreviewClose = document.getElementById('imagePreviewClose');

    // Original Image Viewer Modal Elements
    const originalImageViewerModal = document.getElementById('originalImageViewerModal');
    const originalImageSrc = document.getElementById('originalImageSrc');
    const originalImageClose = document.getElementById('originalImageClose');
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
        originalImageSrc.src = `/api/original-image/${currentJobId}/${encodeURIComponent(magnifiedImagePath)}`;
        originalImageViewerModal.style.display = 'flex';
        
        let indexText = `${magnifiedImageIndex + 1}/${selectedGroup.files.length}`;
        if (magnifiedImagePath === selectedGroup.suggested) {
            magnifiedImageIndexDisplay.innerHTML = `${indexText} <span class="suggested-dot bg-blue-500 rounded-full w-2 h-2 ml-1 inline-block"></span>`;
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
    originalImageClose.addEventListener('click', closeMagnifiedImage);
    originalImageViewerModal.addEventListener('click', (e) => {
        if (e.target === originalImageViewerModal) { // Only close if clicked on the overlay
            closeMagnifiedImage();
        }
    });

    // --- State ---
    let directories = [];
    let selectedDir = null;
    let currentJobId = null;

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
            div.textContent = dir;
            div.className = 'p-2 rounded-md cursor-pointer hover:bg-gray-700';
            if (dir === selectedDir) {
                div.classList.add('bg-indigo-600', 'text-white');
            }
            div.onclick = () => {
                selectedDir = dir;
                renderDirs();
            };
            dirList.appendChild(div);
        });
        updatePrimaryDirOptions();
    }

    function updatePrimaryDirOptions() {
        const currentVal = primaryDirInput.value;
        primaryDirInput.innerHTML = '<option value="">(Select from added directories)</option>';
        directories.forEach(dir => {
            const option = document.createElement('option');
            option.value = dir;
            option.textContent = dir;
            primaryDirInput.appendChild(option);
        });
        if (currentVal && directories.includes(currentVal)) {
            primaryDirInput.value = currentVal;
        }
    }

    function addDirectory() {
        const newDir = dirInput.value.trim();
        if (newDir && !directories.includes(newDir)) {
            directories.push(newDir);
            dirInput.value = '';
            renderDirs();
        }
    }

    function removeDirectory() {
        if (selectedDir) {
            directories = directories.filter(d => d !== selectedDir);
            if (primaryDirInput.value === selectedDir) {
                primaryDirInput.value = '';
            }
            selectedDir = null;
            renderDirs();
        }
    }

    async function startScan() {
        if (directories.length === 0) {
            alert('Please add at least one directory to scan.');
            return;
        }

        const payload = {
            directories: directories,
            primary_dir: primaryDirInput.value || null,
            algorithm: algorithmInput.value,
            hash_size: parseInt(hashSizeInput.value, 10),
            workers: workersInput.value ? parseInt(workersInput.value, 10) : null,
        };

        btnStartScan.disabled = true;
        btnGoReview.disabled = true; // Disable review button until scan is ready
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
                throw new Error(errorData.detail || 'Failed to start scan');
            }

            const data = await response.json();
            currentJobId = data.job_id;
            pollStatus(currentJobId);

        } catch (error) {
            scanStatusEl.textContent = `Error: ${error.message}`;
            btnStartScan.disabled = false;
            scanProgress.style.display = 'none';
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
            } else if (data.status === 'succeeded' || data.status === 'failed') {
                progress = 100;
            }
            
            scanProgressFill.style.width = `${progress}%`;
            scanProgressText.textContent = `${Math.round(progress)}%`;
            
            let statusMessage = `Status: ${data.status}`;
            if (data.status === 'running') {
                statusMessage += ` | Images Hashed: ${data.hashed_images || 0}/${data.total_images || '?'}`;
            }
            if (data.groups !== undefined) {
                statusMessage += ` | Groups Found: ${data.groups}`;
            }
            scanStatusEl.textContent = statusMessage;


            if (data.status === 'running' || data.status === 'pending') {
                setTimeout(() => pollStatus(jobId), 2000); // Poll every 2 seconds
            } else if (data.status === 'succeeded') {
                scanStatusEl.textContent = `Scan complete! Found ${data.groups} groups. Ready for review.`;
                btnGoReview.disabled = false;
                btnStartScan.disabled = false;
                scanProgressFill.classList.remove('transition-all'); // Remove transition after completion
            } else { // failed
                scanStatusEl.textContent = `Scan failed: ${data.message}`;
                btnStartScan.disabled = false;
                scanProgressFill.classList.remove('transition-all'); // Remove transition on error
            }
        } catch (error) {
            scanStatusEl.textContent = `Error polling: ${error.message}`;
            btnStartScan.disabled = false;
            scanProgressFill.classList.remove('transition-all'); // Remove transition on error
        }
    }

    function showScanSetupScreen() {
        screenReview.style.display = 'none';
        screenScanSetup.style.display = 'block';
        // Optionally clear any review state if necessary, but typically a fresh scan setup is desired.
    }

    function showReviewScreen() {
        screenScanSetup.style.display = 'none';
        screenReview.style.display = 'block';
        loadGroups();
    }

    async function loadGroups() {
        if (!currentJobId) return;
        const response = await fetch(`/api/groups?job_id=${currentJobId}`);
        if(response.ok) {
            const data = await response.json();
            allGroups = data.groups; // Store all fetched groups
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
                statusText = `<span class="text-red-400">All Deleted</span>`;
            } else if (decisionStatus === 'kept') {
                statusText = `<span class="text-green-400">All Kept</span>`;
            } else if (decisionStatus === 'mixed') {
                statusText = `<span class="text-yellow-400">Mixed</span>`;
            }


            const thumbnailUrl = group.suggested ? `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(group.suggested)}&max_size=64` : '';
            const isGroupSuggested = group.suggested;

            div.innerHTML = `
                <div class="flex items-center space-x-2">
                    ${thumbnailUrl ? `<img src="${thumbnailUrl}" class="w-8 h-8 object-cover rounded" alt="Thumbnail">` : ''}
                    <div class="flex-grow">
                        <div class="flex items-center space-x-2">
                            <span>Group ${group.id} (${group.files.length} images)</span>
                            ${visitedGroups.has(group.id) ? `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                            </svg>` : ''}
                        </div>
                        <div class="text-sm text-gray-400 flex items-center space-x-1">
                            <span class="decision-tag ${decisionStatus === 'deleted' ? 'bg-red-600' : 'bg-green-600'} text-white px-2 py-0.5 rounded-full text-xs">
                                ${decisionStatus === 'deleted' ? 'Deleted' : 'Kept'}
                            </span>
                            ${isGroupSuggested ? '<span class="suggested-dot bg-blue-500 rounded-full w-2 h-2"></span>' : ''}
                        </div>
                    </div>
                </div>
            `;
            div.className = 'p-3 rounded-md cursor-pointer hover:bg-gray-700';

            if (selectedGroup && group.id === selectedGroup.id) {
                div.classList.add('bg-indigo-600', 'text-white');
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
        heroImageContainer.innerHTML = ''; // Clear existing content

        if (!selectedGroup) {
            heroImageContainer.innerHTML = '<div class="text-center text-gray-400">No group selected.</div>';
            return;
        }

        const keptPaths = decisions.get(selectedGroup.id) || new Set();
        const isSelectedImageKept = keptPaths.has(selectedImage);
        const isSuggested = selectedImage === selectedGroup.suggested;

        // Render hero image badge
        const badge = document.createElement('div');
        let badgeText = '';
        let badgeClass = 'absolute top-2 left-2 text-white text-xs px-2 py-1 rounded-full';

        if (isSelectedImageKept) {
            badgeText = 'Kept';
            badgeClass += ' bg-green-600';
        } else {
            badgeText = 'Deleted';
            badgeClass += ' bg-red-600';
        }
        badge.textContent = badgeText;
        badge.className = badgeClass;
        heroImageContainer.appendChild(badge);
        
        // Add suggested dot for hero image if applicable
        if (selectedImage === selectedGroup.suggested) {
            const suggestedDot = document.createElement('span');
            suggestedDot.className = 'suggested-dot hero-dot bg-blue-500 rounded-full w-3 h-3 absolute top-2 right-2'; // Position as needed
            heroImageContainer.appendChild(suggestedDot);
        }

        const heroTextEl = document.createElement('div');
        heroTextEl.className = 'text-center text-gray-400 mt-2';

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
                imgContainer.className = 'side-by-side-img-container flex flex-col items-center h-full p-2 rounded-md bg-gray-800';

                const img = document.createElement('img');
                img.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(file)}&max_size=1024`;
                img.alt = file;
                img.className = 'w-full h-full object-contain rounded-md bg-gray-900'; // object-contain for vertical fitting

                const imgLabel = document.createElement('div');
                let labelText = file.split('/').pop(); // Display just the filename
                if (isCurrentFileSelected) {
                    labelText = `(Selected) ${labelText}`;
                    imgLabel.classList.add('text-indigo-400', 'font-bold');
                }
                if (isCurrentFileSuggested) {
                    labelText = `(Suggested) ${labelText}`;
                    imgLabel.classList.add('text-blue-400', 'font-bold');
                }
                imgLabel.textContent = labelText;
                imgLabel.className += ' text-sm text-gray-400 mt-2 overflow-hidden whitespace-nowrap overflow-ellipsis max-w-full';


                imgContainer.appendChild(img);
                imgContainer.appendChild(imgLabel);
                sideBySideDiv.appendChild(imgContainer);
            });

            heroImageContainer.appendChild(sideBySideDiv);
            heroTextEl.style.display = 'none'; // Hide general text in side-by-side
        } else {
            // Existing single image view logic
            const img = document.createElement('img');
            img.id = 'heroImg';
            img.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(selectedImage)}&max_size=1024`;
            img.alt = 'Selected image';
            img.className = 'w-full h-auto max-h-[60vh] object-contain rounded-md bg-gray-900';
            heroImageContainer.appendChild(img);
            
            let heroText = selectedImage;
            const imageStats = selectedGroup.stats[selectedImage];
            if (imageStats) {
                heroText += ` | ${imageStats.width}x${imageStats.height} | ${imageStats.size}`;
            }
            heroTextEl.innerHTML = heroText;
        }
        heroImageContainer.appendChild(heroTextEl); // Append text below images
        
        thumbRow.innerHTML = '';
        selectedGroup.files.forEach(file => {
            const thumbContainer = document.createElement('div');
            thumbContainer.className = 'flex flex-col items-center space-y-1 mx-1 py-2'; // Container for image and tag

            const img = document.createElement('img');
            img.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(file)}&max_size=128`;
            img.className = 'h-24 w-24 object-cover rounded-md cursor-pointer border-2 transition-all duration-200';
            
            const isThumbKept = keptPaths.has(file);
            const isThumbSuggested = file === selectedGroup.suggested;

            let tagText = isThumbKept ? 'Kept' : 'Deleted';
            let tagClass = `text-xs px-1 rounded ${isThumbKept ? 'bg-green-600' : 'bg-red-600'} text-white flex items-center space-x-1`;

            if (isThumbKept) {
                img.classList.add('border-green-500');
            } else {
                img.classList.add('border-red-500', 'opacity-50');
            }

            if (file === selectedImage) {
                img.classList.add('!border-indigo-500', '!opacity-100', '!transform', '!scale-105', '!shadow-lg', '!ring-2', '!ring-indigo-400'); // Override
            }
            img.onclick = (event) => {
                event.stopPropagation(); // Prevent event from bubbling up to thumbContainer
                openImagePreview(file);
            };
            
            thumbContainer.appendChild(img);
            // Always show the tag based on decision
            const tag = document.createElement('div');
            tag.className = tagClass;
            tag.innerHTML = `<span>${tagText}</span>${isThumbSuggested ? '<span class="suggested-dot bg-blue-500 rounded-full w-2 h-2"></span>' : ''}`;
            thumbContainer.appendChild(tag);

            // Add an additional click handler to thumbContainer for selection, distinct from preview
            thumbContainer.addEventListener('click', () => {
                selectedImage = file;
                renderSelectedGroup();
            });

            thumbRow.appendChild(thumbContainer);
        });
        updateGroupNavigationButtons(); // Call here
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

    async function applyFinalizeActions(unreviewedAction) {
        const primaryDir = primaryDirInput.value;
        const trash_dir = trashDirInput.value.trim();
        
        let apiCallEndpoint = '/api/actions/trash';
        let apiPayload;

        // First, apply default decisions for unreviewed groups based on unreviewedAction
        currentGroups.forEach(group => {
            if (!visitedGroups.has(group.id)) { // Only apply to genuinely unvisited/undecided groups
                let keptSet = new Set();
                if (unreviewedAction === 'keep_suggested' && group.suggested) {
                    keptSet.add(group.suggested);
                } else if (unreviewedAction === 'keep_primary' && primaryDir) {
                    const primaryFiles = group.files.filter(f => f.startsWith(primaryDir));
                    if (primaryFiles.length > 0) {
                        keptSet.add(primaryFiles[0]);
                    } else if (group.suggested) {
                        keptSet.add(group.suggested);
                    } else if (group.files.length > 0) {
                        keptSet.add(group.files[0]);
                    }
                } else if (unreviewedAction === 'none' && group.suggested) { // Default to keeping suggested if 'none' and unreviewed
                    keptSet.add(group.suggested);
                } else if (unreviewedAction === 'none' && group.files.length > 0) { // Fallback to first if no suggested
                    keptSet.add(group.files[0]);
                }
                decisions.set(group.id, keptSet);
            }
        });

        const toTrash = [];
        currentGroups.forEach(group => {
            const finalKeptPaths = decisions.get(group.id) || new Set();
            group.files.forEach(file => {
                if (!finalKeptPaths.has(file)) {
                    toTrash.push(file);
                }
            });
        });

        if (unreviewedAction === 'keep_primary' && primaryDir) {
            apiCallEndpoint = '/api/actions/trash-non-primary';
            apiPayload = {
                job_id: currentJobId,
                primary_dir: primaryDir,
                destination: trash_dir || null,
            };
        } else {
            apiPayload = {
                job_id: currentJobId,
                paths: toTrash,
                destination: trash_dir || null,
            };
        }

        if (toTrash.length === 0 && unreviewedAction !== 'keep_primary') {
            alert("No files marked for deletion based on current decisions.");
            finalizeModal.style.display = 'none';
            return;
        }

        finalizeMessage.textContent = `Processing deletion of ${toTrash.length} files...`; // Update message
        
        try {
            const response = await fetch(apiCallEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(apiPayload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || response.statusText);
            }

            finalizeModal.style.display = 'none';
            alert(`${toTrash.length} files moved to trash.`);
            loadGroups(); // Reload groups to reflect changes
            visitedGroups.clear(); // Reset visited groups
        } catch (error) {
            finalizeModal.style.display = 'none';
            alert(`Failed to move files to trash: ${error.message}`);
        }
    }

    function finalizePrompt() {
        const unreviewedCount = currentGroups.length - visitedGroups.size;
        finalizeMessage.textContent = `You have decided on ${visitedGroups.size} out of ${currentGroups.length} groups.`;
        
        if (unreviewedCount > 0) {
            unreviewedWarning.style.display = 'block';
            finalizeMessage.textContent += ` There are ${unreviewedCount} unreviewed groups.`;
        } else {
            unreviewedWarning.style.display = 'none';
        }
        
        finalizeModal.style.display = 'flex';
    }


    // --- Event Listeners ---
    btnAddDir.addEventListener('click', addDirectory);
    dirInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addDirectory();
        }
    });
    btnRemoveDir.addEventListener('click', removeDirectory);
    btnStartScan.addEventListener('click', startScan);
    btnGoReview.addEventListener('click', () => {
        if(currentJobId) {
            showReviewScreen();
        } else {
            alert("Please run a scan first.");
        }
    });

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


    // Review screen actions
    actToggleKeep.addEventListener('click', toggleKeepSelected);
    actKeepAll.addEventListener('click', keepAll);
    actDeleteAll.addEventListener('click', deleteAll);
    actTrashNonSuggested.addEventListener('click', trashNonSuggested);

    btnFinalize.addEventListener('click', finalizePrompt);
    btnCancelFinalize.addEventListener('click', () => {
        finalizeModal.style.display = 'none';
    });

    // New finalize modal actions
    optContinueReview.addEventListener('click', () => {
        finalizeModal.style.display = 'none';
    });
    optKeepSuggested.addEventListener('click', () => applyFinalizeActions('keep_suggested'));
    optKeepPrimary.addEventListener('click', () => applyFinalizeActions('keep_primary'));
    optApplyTrash.addEventListener('click', () => applyFinalizeActions('none'));


    window.addEventListener('keydown', (e) => {
        if (screenReview.style.display !== 'block') return;

        let handled = false;
        
        // Handle Escape key for open modals
        if (e.key === 'Escape') {
            if (imagePreviewModal.style.display === 'flex') {
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
                        originalImageSrc.src = `/api/original-image/${currentJobId}/${encodeURIComponent(magnifiedImagePath)}`;
                        let indexText = `${magnifiedImageIndex + 1}/${selectedGroup.files.length}`;
                        if (magnifiedImagePath === selectedGroup.suggested) {
                            magnifiedImageIndexDisplay.innerHTML = `${indexText} <span class="suggested-dot bg-blue-500 rounded-full w-2 h-2 ml-1 inline-block"></span>`;
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
                        originalImageSrc.src = `/api/original-image/${currentJobId}/${encodeURIComponent(magnifiedImagePath)}`;
                        let indexText = `${magnifiedImageIndex + 1}/${selectedGroup.files.length}`;
                        if (magnifiedImagePath === selectedGroup.suggested) {
                            magnifiedImageIndexDisplay.innerHTML = `${indexText} <span class="suggested-dot bg-blue-500 rounded-full w-2 h-2 ml-1 inline-block"></span>`;
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
        if (job.job_id && (job.status === 'succeeded' || job.status === 'running')) {
            currentJobId = job.job_id;
            btnGoReview.disabled = false;
            scanStatusEl.textContent = `Previous scan loaded: ${job.job_id.substring(0, 8)}... (Status: ${job.status}). Click 'Go to Review' to continue.`;
            // Also update primaryDirInput from the loaded job
            // For now, assume primaryDirInput is not managed by job load
        }
    });
});