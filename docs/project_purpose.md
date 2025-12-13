## Purpose: Find images that are similar and allow the user to easily move them to the trash
- Python version: 3.14
- System OS: MacOS 26.1 Tahoe
- Computer: Apple Silicon Macbook Pro
- virtual env: venv `source venv/bin/activate

## Architecture
- Use some system, python `duplicate_images`[library suggested](https://pypi.org/project/duplicate_images/), but can also use other options to create an image similarity database
    - Should be able to provide 1+ directories where images exists. Some files might be videos or mp3s or something else irrelevant.
    - allow user to run the hashing in parallel
- After image similarity database is created create some Web UI that shows the user similar images side by side as a list
    - The user should be able to select options like, all images from one directory if multiple ones are provided, move duplicates to some other directory, auto-delete duplicates
    - Intelligently suggest which image to keep based on resolution, if it is in better focus, etc.  




  ┌─────────────────────────────────────────┐
  │  Finalize Actions                       │
  ├─────────────────────────────────────────┤
  │    ─── Trash Settings: ───  
  |      ⦿ System Trash (default)                       
  │      ○ Custom Path: [__________] [Browse]                                    
  │  ACTION: (radio buttons: Only one can be selected)
  |     - Keep My Decisions & Trash Others
  |         - keeps the images you've selected (keeps suggested image for non-reviewed groups)
  |     - Keep All Suggested
  |         - disregard your selections and ONLY keep suggested image per group
  |     - Keep All in Primary Directory (only if dirs > 1)
  |         ☐ Use Primary Directory Strategy    
  │         [Dropdown: Select primary]           
  │             Reviewed: Your choice wins        
  │             Unreviewed: ALL primary files kept
  |            
  │                                                 
  │ [Cancel] [Continue Reviewing] [Apply Decision]  
  └─────────────────────────────────────────--------┘