/* 3D skateboard model from https://poly.google.com/view/7Dfn4VtTCWY */
/* Rock model from https://poly.google.com/view/dmRuyy1VXEv */

var container;
var collideMeshList = [];
var cubes = [];
var crash = false;
var score = 0;
var scoreText = document.getElementById("score");
var id = 0;
var crashId = " ";
var lastCrashId = " ";
let counter = 3;

let scene, camera, renderer, simplex, plane, geometry, xZoom, yZoom, noiseStrength;
let skateboard, rock, rockMesh;

var bluetoothConnected = false;
var gameStarted = false;
var zOrientation = 0;
var sound;
var glitchPass, composer;

setup();
init();
draw();

function setup(){
	setupNoise();
	setup3DModel();
	setupRockModel();
	setupScene();
	setupSound();
	setupPlane();
	setupLights();
}

function setupSound(){
	sound = new Howl({
    src: ['assets/delorean-dynamite-long-2.m4a'],
    loop: true,
  });
}

function setupNoise() {
  xZoom = 7;
  yZoom = 15;
  noiseStrength = 3;
  simplex = new SimplexNoise();
}

function setupScene() {
    scene = new THREE.Scene();

    let res = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(75, res, 0.1, 1000);
    camera.position.set(0, -20, 1);
    camera.rotation.x = -300;

    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        alpha: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.autoClear = false;
    renderer.setClearColor(0x000000, 0.0);
    renderer.setClearAlpha(1.0);

    document.body.appendChild(renderer.domElement);
}

function setup3DModel(){
	var loader = new THREE.OBJLoader();
	loader.load(
		'assets/Skateboard.obj',
		function ( object ) {
			skateboard = object;
			skateboard.position.set(0, -19, -0.1);
			skateboard.rotation.set(2, 1.58, -0.5);
			skateboard.scale.set(0.3, 0.3, 0.3);
	
			object.traverse( function ( child ) {
				let material = new THREE.MeshStandardMaterial({
					color: new THREE.Color('rgb(195,44,110)'),
				});
        if ( child instanceof THREE.Mesh ) {
          child.material = material;
        }
			});
		
			scene.add( skateboard );
			renderer.render(scene, camera);
		}
	);
}

function setupRockModel(){
	var loader = new THREE.OBJLoader();
	loader.load(
		'assets/PUSHILIN_rock.obj',
		function ( object ) {
			rock = object;
			rock.position.set(1, -18, -0.1);
			rock.rotation.set(2, 1.58, -0.5);
			rock.scale.set(0.4, 0.4, 0.4);

			let material = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x009900, shininess: 30, flatShading: true } );
			rock.traverse( function ( child ) {
				if ( child instanceof THREE.Mesh ) {
					rockMesh = child;
					rockMesh.material = material;
				}
			});
		}
	);
}

function setupPlane() {
  let side = 120;
  geometry = new THREE.PlaneGeometry(40, 40, side, side);

	let material = new THREE.MeshStandardMaterial({
		color: new THREE.Color('rgb(16,28,89)'),
	});

	plane = new THREE.Mesh(geometry, material);
  plane.castShadow = true;
	plane.receiveShadow = true;
	scene.add(plane);

	const wireframeGeometry = new THREE.WireframeGeometry( geometry );
	const wireframeMaterial = new THREE.LineBasicMaterial( { color: 'rgb(93,159,153)' } );
	const wireframe = new THREE.LineSegments( wireframeGeometry, wireframeMaterial );

	plane.add( wireframe );
}

function setupLights() {
	let ambientLight = new THREE.AmbientLight(new THREE.Color('rgb(195,44,110)'));
	ambientLight.position.set(10, 0, 50);
    scene.add(ambientLight);
    
    let spotLight = new THREE.SpotLight(0xffffff);
    spotLight.position.set(10, 0, 50);
    spotLight.castShadow = true;
    scene.add(spotLight);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function init() {
    scene.fog = new THREE.FogExp2( new THREE.Color("#5a008a"), 0.0003 );

    container = document.getElementById("ThreeJS");
    container.appendChild(renderer.domElement);
    renderer.render(scene, camera);

    window.addEventListener("resize", onWindowResize);
}

function draw() {
  let offset = Date.now() * 0.0004;
  adjustVertices(offset);
	if(gameStarted){
		requestAnimationFrame(draw);
		update()
	}
	if(composer){
		composer.render();
	}
	renderer.render(scene, camera);
}

function adjustVertices(offset) {
  for (let i = 0; i < plane.geometry.vertices.length; i++) {
    let vertex = plane.geometry.vertices[i];
    let x = vertex.x / xZoom;
    let y = vertex.y / yZoom;
    
    if(vertex.x < -2.5 || vertex.x > 2.5){
      let noise = simplex.noise2D(x, y + offset) * noiseStrength; 
      vertex.z = noise;
    }
  }
  geometry.verticesNeedUpdate = true;
  geometry.computeVertexNormals();
}

function update() {
	skateboard.position.x -= zOrientation;

	if(skateboard.position.x > 2 && zOrientation < 0){
		skateboard.position.x += zOrientation;
	}
	if(skateboard.position.x < -2 && zOrientation > 0){
		skateboard.position.x += zOrientation;
	}

	let skateboardGeometry = new THREE.Geometry().fromBufferGeometry( skateboard.children[0].geometry );

	var originPoint = skateboard.position.clone();

	for (var vertexIndex = 0; vertexIndex < skateboardGeometry.vertices.length; vertexIndex++) {
		var localVertex = skateboardGeometry.vertices[vertexIndex].clone();
		var globalVertex = localVertex.applyMatrix4(skateboard.matrix);
		var directionVector = globalVertex.sub(skateboard.position);

		var ray = new THREE.Raycaster(originPoint, directionVector.clone().normalize());
		var collisionResults = ray.intersectObjects(collideMeshList);
		if (collisionResults.length > 0 && collisionResults[0].distance < directionVector.length()) {
				crash = true;
				crashId = collisionResults[0].object.name;
				break;
		}
		crash = false;
	}

	glitchPass = new THREE.GlitchPass();
	composer = new THREE.EffectComposer( renderer );

	if (crash) {
		if (crashId !== lastCrashId) {
			score -= 1;
			lastCrashId = crashId;

			glitchPass.enabled = true;
			composer.addPass( glitchPass );
		}

		document.getElementById('explode_sound').play();
	} else {
		glitchPass.enabled = false;
		composer.addPass( glitchPass );
	}

	if (Math.random() < 0.03 && cubes.length < 10) {
		makeRandomCube();
	}

  for (i = 0; i < cubes.length; i++) {
		if (cubes[i].position.y < -20) {
			scene.remove(cubes[i]);
			cubes.splice(i, 1);
			collideMeshList.splice(i, 1);
			//if(!crash){
				score += 1;
			//}
		} else {
			cubes[i].position.y -= 0.05;
		}
	}
	scoreText.innerText = "Score:" + Math.floor(score);
}

function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}

function makeRandomCube() {
	let material = new THREE.MeshPhongMaterial( { color: 0xffffff, specular: 0x009900, shininess: 30, flatShading: true } );
	let rockGeometry = new THREE.Geometry().fromBufferGeometry( rock.children[0].geometry );

	var object = new THREE.Mesh(rockGeometry, material);
	object.position.x = getRandomArbitrary(-2, 2);
	object.position.y = getRandomArbitrary(50, 0);
	object.position.z = 0;

	object.scale.set(0.4, 0.4, 0.4);
	object.rotation.set(2, 1.58, -0.5);

	cubes.push(object);
	object.name = "box_" + id;
	id++;
	collideMeshList.push(object);

	scene.add(object);
}

function displayCounter(){
	const counterDiv = document.getElementsByClassName('counter')[0];
	  counterDiv.innerHTML = counter;
	if(counter > 0){
	  counter--;
	} else if(counter === 0){
	  clearInterval(interval);
		  counterDiv.classList.add('fade-out');
		  gameStarted = true;
		  draw();
	}
}

let interval;

window.onload = () => {
	if(!isMobile()){
		let previousValue;
		const connectButton = document.getElementById('connect');
	
		const socket = io();
	 
		socket.on('mobile orientation', function(e){
			if(!bluetoothConnected){
				bluetoothConnected = true;
				connectButton.classList.add('fade-out');
						
				const title = document.getElementsByClassName('title')[0];
						title.classList.add('fade-out');
						sound.play()
						sound.fade(0, 1, 3000);

				interval = setInterval(function(){
					displayCounter();
					},1000);
			}
	
			if(previousValue !== e){
				zOrientation = -e / 300
			}
			previousValue = e
		})
	}
}

const isMobile = () => {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)))check = true})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
}
