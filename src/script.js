import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MAX_RETRIES = 3; // Maximum number of retry attempts

// Helper function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Set default model path or retrieve from URL parameters
let modelPath = getUrlParameter('object') || `${import.meta.env.BASE_URL}models/mw_hi.glb`;

// Scene
const scene = new THREE.Scene();
scene.background = null; // Transparent background

// Camera
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 0, 2.5); // Closer initial position

// Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false, // Disable antialiasing for performance
    alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setClearColor(0x000000, 0); // Fully transparent background

// Lights
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0); // White sky and ground
scene.add(hemisphereLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3); // Soft ambient light
scene.add(ambientLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.enablePan = false;
controls.minDistance = 1.5;
controls.maxDistance = 5;

// GLTF Loader
const gltfLoader = new GLTFLoader();

// Variable to track the current model
let currentModel = null;

// Function to dispose of a model
function disposeModel(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) disposeMaterial(child.material);
        }
    });
    scene.remove(model);
}

// Dispose of a material
function disposeMaterial(material) {
    for (const key in material) {
        const value = material[key];
        if (value && typeof value === 'object' && 'minFilter' in value) {
            value.dispose();
        }
    }
    material.dispose();
}

// Load model with retry logic
function loadModelWithRetry(url, retries = MAX_RETRIES) {
    return new Promise((resolve, reject) => {
        function attemptLoad(retryCount) {
            gltfLoader.load(
                url,
                (gltf) => resolve(gltf.scene),
                undefined,
                (error) => {
                    console.warn(`Model load failed, attempt ${retryCount + 1}/${retries}`);
                    if (retryCount < retries - 1) {
                        attemptLoad(retryCount + 1);
                    } else {
                        reject(new Error('Failed to load model after multiple attempts'));
                    }
                }
            );
        }
        attemptLoad(0);
    });
}

// Show spinner
function showSpinner() {
    const spinner = document.createElement('div');
    spinner.id = 'spinner';
    spinner.innerHTML = `<div class="loader"></div>`;
    document.body.appendChild(spinner);
}

// Hide spinner
function hideSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.remove();
}

// Show persistent toast with close button
function showPersistentToast(message, type = 'error') {
    const toastContainerId = 'toast-container';
    let toastContainer = document.getElementById(toastContainerId);

    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.id = toastContainerId;
        toastContainer.style.position = 'fixed';
        toastContainer.style.bottom = '20px';
        toastContainer.style.left = '50%';
        toastContainer.style.transform = 'translateX(-50%)';
        toastContainer.style.zIndex = '1000';
        toastContainer.style.pointerEvents = 'none';
        document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.marginLeft = '10px';
    closeButton.style.background = 'transparent';
    closeButton.style.border = 'none';
    closeButton.style.color = '#fff';
    closeButton.style.cursor = 'pointer';
    closeButton.style.fontSize = '1.5rem';
    closeButton.onclick = () => toast.remove();

    toast.appendChild(closeButton);
    toastContainer.appendChild(toast);
}

// Load and display model
async function loadAndDisplayModel() {
    try {
        if (currentModel) {
            disposeModel(currentModel);
            currentModel = null;
        }

        showSpinner();

        try {
            const model = await loadModelWithRetry(modelPath);
            scene.add(model);
            currentModel = model;

            renderer.compile(scene, camera);

            hideSpinner();
            showPersistentToast('Model loaded successfully.', 'success');
        } catch (loadError) {
            console.warn('Remote model load failed. Loading fallback model.');
            const originalModelPath = modelPath; // Keep track of the requested model
            modelPath = `${import.meta.env.BASE_URL}models/mw_hi.glb`; // Set fallback model

            const fallbackModel = await loadModelWithRetry(modelPath);
            scene.add(fallbackModel);
            currentModel = fallbackModel;

            hideSpinner();
            showPersistentToast(
                `Unable to load the requested model (${originalModelPath}). A temporary model has been loaded instead.`,
                'error'
            );
        }
    } catch (error) {
        console.error('Critical error loading model:', error);
        hideSpinner();
        showPersistentToast('Critical error loading model.', 'error');
    }
}

// Debounced resize handler
function debounce(func, wait, immediate) {
    let timeout;
    return function () {
        const context = this,
            args = arguments;
        const later = function () {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}

// Handle resize
window.addEventListener(
    'resize',
    debounce(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    }, 200)
);

// Start the animation loop after loading the model
function startAnimationLoop() {
    function animate() {
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();
}

// Initialize
loadAndDisplayModel().then(startAnimationLoop);