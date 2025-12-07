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
    const workersInput = document.getElementById('workers');
    const trashDirInput = document.getElementById('trashDir');

    // --- DOM Elements (Review Screen) ---
    const screenScanSetup = document.getElementById('screen-scan-setup');
    const screenReview = document.getElementById('screen-review');
    const groupListEl = document.getElementById('groupList');
    const heroImg = document.getElementById('heroImg');
    const heroImageText = document.getElementById('heroImageText');
    const heroImageBadge = document.getElementById('heroImageBadge');
    const thumbRow = document.getElementById('thumbRow');

    const actToggleKeep = document.getElementById('actToggleKeep');
    const actKeepAll = document.getElementById('actKeepAll');
    const actDeleteAll = document.getElementById('actDeleteAll');
    const actTrashNonSuggested = document.getElementById('actTrashNonSuggested');

    const pendingText = document.getElementById('pendingText');
    const btnFinalize = document.getElementById('btnFinalize');
    const finalizeModal = document.getElementById('finalizeModal');
    const finalizeMessage = document.getElementById('finalizeMessage');
    const btnCancelFinalize = document.getElementById('btnCancelFinalize');
    const unreviewedWarning = document.getElementById('unreviewedWarning');
    const optContinueReview = document.getElementById('optContinueReview');
    const optKeepSuggested = document.getElementById('optKeepSuggested');
    const optKeepPrimary = document.getElementById('optKeepPrimary');
    const optApplyTrash = document.getElementById('optApplyTrash');

    // --- State ---
    let directories = [];
    let selectedDir = null;
    let currentJobId = null;

    // --- Review Screen State ---
    let currentGroups = [];
    let selectedGroup = null;
    let selectedImage = null;
    let decisions = new Map(); // { groupId: Set<string> of paths to keep }
    let visitedGroups = new Set(); // To track reviewed groups

    // --- Functions ---

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
        scanStatusEl.textContent = 'Starting scan...';
        scanProgress.style.display = 'block';
        scanProgressFill.style.width = '5%';

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

            scanStatusEl.textContent = `Status: ${data.status} | Groups Found: ${data.groups}`;
            
            // Simple progress simulation
            let progress = 20;
            if (data.status === 'running') {
                 progress += 30;
            } else if (data.status === 'succeeded' || data.status === 'failed') {
                progress = 100;
            }
            scanProgressFill.style.width = `${progress}%`;


            if (data.status === 'running' || data.status === 'pending') {
                setTimeout(() => pollStatus(jobId), 2000); // Poll every 2 seconds
            } else if (data.status === 'succeeded') {
                scanStatusEl.textContent = `Scan complete! Found ${data.groups} groups.`;
                btnGoReview.disabled = false;
                btnStartScan.disabled = false;
            } else { // failed
                scanStatusEl.textContent = `Scan failed: ${data.message}`;
                btnStartScan.disabled = false;
            }
        } catch (error) {
            scanStatusEl.textContent = `Error polling: ${error.message}`;
            btnStartScan.disabled = false;
        }
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
            currentGroups = data.groups;
            decisions = new Map(); // Reset decisions
            visitedGroups = new Set(); // Reset visited groups

            currentGroups.forEach(group => {
                const keptSet = new Set();
                if (group.suggested) {
                    keptSet.add(group.suggested); // Keep suggested by default
                } else if (group.files.length > 0) {
                    keptSet.add(group.files[0]); // Fallback to first if no suggested
                }
                decisions.set(group.id, keptSet);
            });

            if (currentGroups.length > 0) {
                selectedGroup = currentGroups[0];
                selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
            } else {
                selectedGroup = null;
                selectedImage = null;
            }
            renderGroupList();
            renderSelectedGroup();
            updatePendingActions();
        } else {
            alert('Could not load groups.');
        }
    }

    function renderGroupList() {
        groupListEl.innerHTML = '';
        currentGroups.forEach(async group => {
            const div = document.createElement('div');
            const keptPaths = decisions.get(group.id) || new Set();
            const keptCount = keptPaths.size;
            const deletedCount = group.files.length - keptCount;
            
            let statusText = `Kept: ${keptCount}, Deleted: ${deletedCount}`;
            if (keptCount === 0 && group.files.length > 0) {
                statusText = `<span class="text-red-400">All Deleted</span>`;
            } else if (keptCount === group.files.length) {
                statusText = `<span class="text-green-400">All Kept</span>`;
            } else if (keptCount > 0 && deletedCount > 0) {
                statusText = `<span class="text-yellow-400">Mixed</span>`;
            }


            const thumbnailUrl = group.suggested ? `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(group.suggested)}&max_size=64` : '';

            div.innerHTML = `
                <div class="flex items-center space-x-2">
                    ${thumbnailUrl ? `<img src="${thumbnailUrl}" class="w-8 h-8 object-cover rounded" alt="Thumbnail">` : ''}
                    <div class="flex-grow">
                        <div>Group ${group.id} (${group.files.length} images)</div>
                        <div class="text-sm text-gray-400">${statusText}</div>
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
    }

    function renderSelectedGroup() {
        if (!selectedGroup) {
            heroImg.src = '';
            heroImageText.innerHTML = 'No group selected.';
            heroImageBadge.style.display = 'none';
            thumbRow.innerHTML = '';
            return;
        }

        const keptPaths = decisions.get(selectedGroup.id) || new Set();
        const isSelectedImageKept = keptPaths.has(selectedImage);
        const isSuggested = selectedImage === selectedGroup.suggested;

        heroImg.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(selectedImage)}`;
        
        let heroText = selectedImage;
        const imageStats = selectedGroup.stats[selectedImage];
        if (imageStats) {
            heroText += ` | ${imageStats.width}x${imageStats.height} | ${imageStats.size}`;
        }
        heroImageText.innerHTML = heroText;

        // Update hero image badge
        heroImageBadge.style.display = 'block';
        if (isSuggested) {
            heroImageBadge.textContent = 'Suggested';
            heroImageBadge.className = 'absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full';
        } else if (isSelectedImageKept) {
            heroImageBadge.textContent = 'Kept';
            heroImageBadge.className = 'absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full';
        } else {
            heroImageBadge.textContent = 'To be Deleted';
            heroImageBadge.className = 'absolute top-2 left-2 bg-red-600 text-white text-xs px-2 py-1 rounded-full';
        }


        thumbRow.innerHTML = '';
        selectedGroup.files.forEach(file => {
            const img = document.createElement('img');
            img.src = `/api/thumbnail?job_id=${currentJobId}&path=${encodeURIComponent(file)}&max_size=128`;
            img.className = 'h-24 rounded-md cursor-pointer border-2';
            
            if (keptPaths.has(file)) {
                img.classList.add('border-green-500');
            } else {
                img.classList.add('border-red-500', 'opacity-50');
            }

            if (file === selectedImage) {
                img.classList.add('!border-indigo-500', '!opacity-100'); // Override
            }
            img.onclick = () => {
                selectedImage = file;
                renderSelectedGroup();
            };
            thumbRow.appendChild(img);
        });
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

    function advanceToNextGroup() {
        const currentIndex = currentGroups.findIndex(g => g.id === selectedGroup.id);
        if (currentIndex + 1 < currentGroups.length) {
            selectedGroup = currentGroups[currentIndex + 1];
            // Select the first kept image in the new group, or the first file if none kept
            const newKeptPaths = decisions.get(selectedGroup.id) || new Set();
            selectedImage = Array.from(newKeptPaths)[0] || selectedGroup.files[0];
            renderGroupList();
            renderSelectedGroup();
        } else {
            // Optionally, give feedback that all groups are reviewed
            alert("All groups reviewed!");
        }
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
        const currentIndex = currentGroups.findIndex(g => g.id === selectedGroup.id);
        
        switch (e.key) {
            case 'ArrowUp':
                if (currentIndex > 0) {
                    selectedGroup = currentGroups[currentIndex - 1];
                    selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
                    renderGroupList();
                    renderSelectedGroup();
                }
                handled = true;
                break;
            case 'ArrowDown':
                if (currentIndex < currentGroups.length - 1) {
                    selectedGroup = currentGroups[currentIndex + 1];
                    selectedImage = Array.from(decisions.get(selectedGroup.id) || [])[0] || selectedGroup.files[0];
                    renderGroupList();
                    renderSelectedGroup();
                }
                handled = true;
                break;
            case 'ArrowLeft':
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
            case 'ArrowRight':
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