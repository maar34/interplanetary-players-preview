import * as THREE from "../node_modules/three/build/three.module.js"
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const MAX_RETRIES = 3; // Maximum number of retry attempts
const FALLBACK_MODEL = '/assets/models/not-found-low.glb'; // Ensure this path is correct

// Helper function to get URL parameters
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Scene Setup
const scene = new THREE.Scene();
scene.background = null; // Transparent background

// Camera Setup
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 0, 1.5);

// Renderer Setup
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

// Lights Setup
const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.0);
scene.add(hemisphereLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

// Controls Setup
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.enablePan = false;
controls.minDistance = 1.5;
controls.maxDistance = 3;

// GLTF Loader
const gltfLoader = new GLTFLoader();

// Variable to track the current model
let currentModel = null;

// Spinner Management
function showSpinner() {
    if (!document.getElementById('spinner')) { // Prevent multiple spinners
        const spinner = document.createElement('div');
        spinner.id = 'spinner';
        spinner.innerHTML = `
    <div class="orbit-container">
      <div class="orbit-dot"></div>
    </div>
    <div class="loading-text">Loading...</div>
  `;
        document.body.appendChild(spinner);
    }
}

function hideSpinner() {
    const spinner = document.getElementById('spinner');
    if (spinner) spinner.remove();
}

// Dispose of the current model
function disposeModel(model) {
    if (!model) return;
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
        if (value && typeof value.dispose === 'function') {
            value.dispose();
        }
    }
}

// Load model with retry logic
async function loadModel(url, retries = MAX_RETRIES) {
    return new Promise((resolve, reject) => {
        function attemptLoad(attempt) {
            gltfLoader.load(
                url,
                (gltf) => resolve(gltf.scene),
                undefined,
                (error) => {
                    if (attempt < retries - 1) {
                        console.warn(`Retrying to load model: ${url} (Attempt ${attempt + 1}/${retries})`);
                        attemptLoad(attempt + 1);
                    } else {
                        reject(error);
                    }
                }
            );
        }
        attemptLoad(0);
    });
}

// Load and display model with fallback
async function loadAndDisplayModel(url, isFallback = false) {
    console.log(`Attempting to load model from: ${url}, isFallback: ${isFallback}`);

    if (currentModel) {
        disposeModel(currentModel);
        currentModel = null;
    }

    // Show spinner and loading message only for the main model
    if (!isFallback) {
        showSpinner();
        //showToast('Loading model, please wait...', 'info');
    }

    try {
        const model = await loadModel(url); // Attempt to load the model
        model.traverse((child) => {
            if (child.isMesh) {
                if (!(child.material instanceof THREE.MeshStandardMaterial)) {
                    child.material = new THREE.MeshStandardMaterial({
                        map: child.material.map || null,
                        metalness: 0.3,
                        roughness: 0.7,
                    });
                }
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
        model.position.set(0, 0, 0);
        scene.add(model);
        currentModel = model;

        hideSpinner();

        // Show success toast only for the main model (not fallback)
        if (!isFallback) {
            //showToast('Model loaded successfully.', 'success');
        }
    } catch (error) {
        console.error(`Failed to load model from ${url}`, error);

        hideSpinner();

        // Handle fallback model loading
        if (!isFallback) {
            // Show error toast for the main model failure
            //showToast('Unable to load the requested model.', 'error', true);
            // Attempt to load the fallback model
            await loadAndDisplayModel(FALLBACK_MODEL, true);
        } else {
            // Final error toast for fallback failure
            //showToast('Fallback model also failed to load.', 'error', true);
        }
    }
}

// Handle window resizing
window.addEventListener('resize', () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
});

// Start animation loop
function startAnimationLoop() {
    function animate() {
        controls.update();
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();
}

// Initialize the scene
(async function init() {
    const modelParam = getUrlParameter('model');

    if (!modelParam) {
        // No model URL provided; load fallback
        //showToast('No model URL provided. Loading fallback model.', 'error', true);
        await loadAndDisplayModel(FALLBACK_MODEL, true);
    } else {
        // Model URL provided; attempt to load it
        await loadAndDisplayModel(modelParam, false);
    }

    // Start the animation loop after attempting to load the model
    startAnimationLoop();
})();