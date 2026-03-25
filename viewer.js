// 解析 URL 参数，获取模型路径
function getModelPathFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const model = params.get("model");
    return model;
}

const modelPath = getModelPathFromUrl();

const titleEl = document.getElementById("modelTitle");
const descEl = document.getElementById("modelDesc");
const loadingHint = document.getElementById("loadingHint");

if (!modelPath) {
    if (loadingHint) loadingHint.style.display = "none";
    if (titleEl) titleEl.textContent = "未指定模型文件";
    if (descEl) {
        descEl.textContent =
            "URL 中缺少 model 参数，例如：viewer.html?model=models/model1.glb。请检查链接是否正确。";
    }
} else {
    if (titleEl) {
        const fileName = modelPath.split("/").pop() || modelPath;
        titleEl.textContent = "当前模型：" + fileName;
    }
}

// 基于 Three.js 的简单查看器
let scene, camera, renderer, controls;
let currentModel = null;

function initThree() {
    const container = document.getElementById("viewerContainer");
    const canvas = document.getElementById("viewerCanvas");
    if (!container || !canvas) return;

    const width = container.clientWidth || 800;
    // 有些布局（全屏固定 + 百分比高度）下首次渲染时 clientHeight 可能为 0
    // 用 getBoundingClientRect() 做兜底，确保渲染器尺寸正确。
    let height = container.clientHeight;
    if (!height || height <= 0) {
        const rect = container.getBoundingClientRect();
        height = rect.height || 480;
    }

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(3, 3, 5);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(width, height);

    // 关键：启用正确的色彩和色调映射
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // 调高曝光，让模型整体更亮（包括可能存在的“文字”材质）
    renderer.toneMappingExposure = 1.6;

    // 加强光照，让高光/白色更明显
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
    dirLight.position.set(8, 12, 10);
    scene.add(dirLight);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.9);
    hemi.position.set(0, 30, 0);
    scene.add(hemi);

    // 反向补光，避免模型文字一侧过暗
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight2.position.set(-10, 6, -6);
    scene.add(dirLight2);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 1;
    controls.maxDistance = 20;

    window.addEventListener("resize", onWindowResize);

    // 监听容器尺寸变化，确保在布局完成后也能刷新 renderer 尺寸
    if (typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => onWindowResize());
        ro.observe(container);
    } else {
        // 兜底：下一帧再算一次尺寸
        window.requestAnimationFrame(() => onWindowResize());
    }

    // 双击重置视角
    canvas.addEventListener("dblclick", () => {
        controls.reset();
    });

    animate();
}

function onWindowResize() {
    if (!camera || !renderer) return;
    const container = document.getElementById("viewerContainer");
    if (!container) return;

    const width = container.clientWidth || 800;
    let height = container.clientHeight;
    if (!height || height <= 0) {
        const rect = container.getBoundingClientRect();
        height = rect.height || 480;
    }

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

function frameModel(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    model.position.sub(center); // 将模型中心移到原点

    const maxDim = Math.max(size.x, size.y, size.z);
    const fitDistance = maxDim * 1.8;

    camera.position.set(fitDistance, fitDistance, fitDistance);
    camera.lookAt(0, 0, 0);
    if (controls) {
        controls.target.set(0, 0, 0);
        controls.update();
    }
}

function loadModel(path) {
    if (!path) return;
    if (!THREE || !THREE.GLTFLoader) {
        console.error("GLTFLoader 未加载");
        return;
    }

    if (loadingHint) loadingHint.style.display = "flex";

    const loader = new THREE.GLTFLoader();
    loader.load(
        path,
        (gltf) => {
            if (currentModel) {
                scene.remove(currentModel);
            }
            currentModel = gltf.scene;
            scene.add(currentModel);
            frameModel(currentModel);
            if (loadingHint) loadingHint.style.display = "none";
        },
        undefined,
        (error) => {
            console.error("模型加载失败：", error);
            if (loadingHint) {
                loadingHint.textContent =
                    "模型加载失败，请检查文件路径或跨域设置（CORS）。";
            }
        }
    );
}

// 初始化并加载
window.addEventListener("DOMContentLoaded", () => {
    initThree();
    if (modelPath) {
        loadModel(modelPath);
    }
});

