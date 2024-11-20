import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MAX_RETRIES = 3; // Maximum number of retry attempts

// Helper function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Retrieve the model path from the URL
const modelPath = getUrlParameter('model'); // Changed from 'object' to 'model'

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
camera.position.set(0, 0, 2.5);

// Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

// Lights
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
scene.add(hemisphereLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.minDistance = 1.5;
controls.maxDistance = 5;

// GLTF Loader
const gltfLoader = new GLTFLoader();

// Variable to track the current model
let currentModel = null;

// Dispose functions
function disposeModel(model) {
    model.traverse((child) => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) disposeMaterial(child.material);
        }
    });
    scene.remove(model);
}

function disposeMaterial(material) {
    for (const key in material) {
        const value = material[key];
        if (value && typeof value === 'object' && 'minFilter' in value) {
            value.dispose();
        }
    }
    material.dispose();
}

// Show toast (auto-dismiss)
function showToast(message, type = 'info', duration = 1000) {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fade-out 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Show persistent toast with close button (only for errors)
function showPersistentToast(message, type = 'error') {
    const toastContainer = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Create a span to hold the message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    // Add close button for persistent toasts
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.onclick = () => toast.remove();
    toast.appendChild(closeButton);

    toastContainer.appendChild(toast);
}

// Create toast container
function createToastContainer() {
    const toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    document.body.appendChild(toastContainer);
    return toastContainer;
}

// Load model with retry logic
async function loadModel(url, retries = MAX_RETRIES) {
    let retryCount = 0;
    while (retryCount < retries) {
        try {
            console.log(`Attempting to load model: ${url} (Attempt ${retryCount + 1}/${retries})`);
            const gltf = await gltfLoader.loadAsync(url);
            console.log(`Successfully loaded model: ${url}`);
            return gltf.scene;
        } catch (error) {
            retryCount++;
            console.warn(`Failed to load model at ${url}, retry ${retryCount}/${retries}`);
        }
    }
    throw new Error(`Failed to load model after ${retries} retries: ${url}`);
}

// Load and display model
async function loadAndDisplayModel() {
    if (!modelPath) {
        showPersistentToast('No model URL provided. Please specify a model using the "model" URL parameter.', 'error');
        return;
    }

    try {
        if (currentModel) {
            disposeModel(currentModel);
            currentModel = null;
        }

        showSpinner();
        showToast('Loading model, please wait...', 'info', 1000);

        // Attempt to load the model from the URL
        try {
            const decodedModelPath = decodeURIComponent(modelPath);
            const model = await loadModel(decodedModelPath); // Try to load the primary model
            scene.add(model);
            currentModel = model;

            renderer.compile(scene, camera);

            hideSpinner();
            showToast('Model loaded successfully.', 'success', 1000);
        } catch (error) {
            console.error(`Error loading model from URL (${modelPath}):`, error);
            hideSpinner();
            showPersistentToast(
                `Unable to load the requested model. Please check the URL and try again.`,
                'error'
            );
        }
    } catch (criticalError) {
        console.error('Critical error loading model:', criticalError);
        hideSpinner();
        showPersistentToast('Critical error loading model.', 'error');
    }
}

// Spinner management
function showSpinner() {
    const spinner = document.createElement('div');
    spinner.id = 'spinner';
    spinner.innerHTML = `<div class="loader"></div>`;
    document.body.appendChild(spinner);
}

function hideSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.remove();
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

// Start animation loop
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