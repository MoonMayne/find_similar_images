# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

# Read version from VERSION file
try:
    with open('VERSION', 'r') as f:
        VERSION = f.read().strip()
except:
    VERSION = '1.0.0'

# Collect all data files
datas = [
    ('backend/templates', 'backend/templates'),
    ('backend/static', 'backend/static'),
]

# Collect all Python packages
hiddenimports = [
    'tkinter',
    '_tkinter',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'backend.api.routes',
    'backend.core.hash_engine',
    'backend.core.file_manager',
    'backend.utils.image_utils',
    'backend.utils.thumbnails',
    'backend.utils.cleanup',
    'backend.storage',
    'backend.state',
    'backend.config',
]

a = Analysis(
    ['launcher.py'],
    pathex=[],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='FindSimilarImages',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,  # No console window (we have GUI now)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='FindSimilarImages',
)

app = BUNDLE(
    coll,
    name='FindSimilarImages.app',
    icon='AppIcon.icns',
    bundle_identifier='com.github.findsimilarimages',
    info_plist={
        'CFBundleName': 'Find Similar Images',
        'CFBundleDisplayName': 'Find Similar Images',
        'CFBundleVersion': VERSION,
        'CFBundleShortVersionString': VERSION,
        'NSHighResolutionCapable': True,
    },
)
