// background.js - Professional User-Image Montage Background
let scene, camera, renderer;
let slides = [];
const textureLoader = new THREE.TextureLoader();

const CONFIG = {
    heroImage: 'assets/new3.png',
    portalImage: 'assets/new3.png',
    opacity: 0.6 // Increased for more vibrant visibility
};

function initThree() {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const loadSlide = (path, zPos) => {
        const tex = textureLoader.load(path);
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: 0,
            depthWrite: false
        });

        // Massive geometry to guarantee zero gaps even during movement
        // We use a fixed massive size and rely on THREE.MathUtils.lerp to keep it centered
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(800, 450), mat);
        plane.position.z = zPos;
        plane.userData = { driftPhase: Math.random() * Math.PI * 2 };
        scene.add(plane);
        return plane;
    };

    slides[0] = loadSlide(CONFIG.heroImage, -100);
    slides[1] = loadSlide(CONFIG.portalImage, -120);

    camera.position.z = 100;
    animate();
}

let scrollProgress = 0;
window.addEventListener('scroll', () => {
    const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress = window.pageYOffset / (totalHeight || 1);
});

function animate() {
    requestAnimationFrame(animate);
    const time = Date.now() * 0.001;

    slides.forEach((slide, idx) => {
        if (!slide || !slide.material.map) return;

        // 1. Motion Animation (Ken Burns / Parallax)
        const scale = 1.1 + Math.sin(time * 0.1 + idx) * 0.05;
        slide.scale.set(scale, scale, 1);
        slide.position.x = Math.sin(time * 0.2 + idx) * 3;
        slide.position.y = Math.cos(time * 0.15 + idx) * 2;

        // 2. Scroll Fading Transition
        // Hero slide fades out as we scroll to portal
        if (idx === 0) {
            slide.material.opacity = THREE.MathUtils.lerp(slide.material.opacity, CONFIG.opacity * (1 - scrollProgress * 1.5), 0.05);
        } else {
            // Portal slide fades in
            slide.material.opacity = THREE.MathUtils.lerp(slide.material.opacity, CONFIG.opacity * (scrollProgress * 2 - 0.5), 0.05);
        }
    });

    // Suble tilt
    scene.rotation.y = Math.sin(time * 0.1) * 0.02;

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('DOMContentLoaded', initThree);
