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

// Camera parameters from URL or defaults
const CAMERA_POS_Z = parseFloat(getUrlParameter('camZ')) || 1.5;
const MIN_DISTANCE = parseFloat(getUrlParameter('minDist')) || 1.0;
const MAX_DISTANCE = parseFloat(getUrlParameter('maxDist')) || 3.0;

// Global flag – if the URL contains alphaMode=1|true|opaque we will force all mesh materials opaque
const FORCE_OPAQUE = ['1', 'true', 'opaque'].includes((getUrlParameter('alphaMode') || '').toLowerCase());

// Global flag – if the URL contains wireframe=1|true|on, we render models in wireframe mode
const FORCE_WIREFRAME = ['1', 'true', 'on'].includes((getUrlParameter('wireframe') || '').toLowerCase());

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
camera.position.set(0, 0, CAMERA_POS_Z);

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

const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
scene.add(ambientLight);


// Controls Setup
const controls = new OrbitControls(camera, renderer.domElement);


// scene settings
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;

scene.background = new THREE.Color('#000000');

controls.enableDamping = true;
controls.dampingFactor = 0.125;

controls.enablePan = false;
controls.minDistance = MIN_DISTANCE;
controls.maxDistance = MAX_DISTANCE;

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
   // console.log(`Attempting to load model from: ${url}, isFallback: ${isFallback}`);

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
                // Force materials to opaque when the flag is enabled
                if (FORCE_OPAQUE) {
                    const m = child.material;
                    if (m.transparent || (m.transmission && m.transmission > 0)) {
                        m.transparent = false;
                        m.opacity = 1;
                        if ('transmission' in m) m.transmission = 0;
                        m.alphaTest = 0;
                        m.needsUpdate = true;
                    }
                }
                // Enable wireframe if requested
                if (FORCE_WIREFRAME) {
                    child.material.wireframe = true;
                    child.material.needsUpdate = true;
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