**webgpu-obj-import**

# Overview

Functions to import, map Material to Textures and render .obj files in WebGPU.

## Usage

### Initializing

```typescript
import { CustomShader, MaterialObject, ObjMesh, MaterialURLs } from "webgpu-obj-import";

// creates Buffer with the .obj info
const objectMesh = new ObjMesh();
await this.objectMesh.initialize(this.device, "dist/models/Test.obj");

// access the buffer
this.objectMesh.buffer

// creates the Texure Array and Sampler
const objectMaterial = new MaterialObject();

// You can set a default image to be used
this.objectMaterial.setDefaultImageURL("dist/img/materials/default.jpg");


// map the materials and the images used in the textures
const objectMaterialsNames: MaterialURLs  = {
"01Default": "07__Default.png",
"03Default": "default.jpg",
"02Default": "piso.png",
};

await this.objectMaterial.initialize(this.device, objectMaterialsNames, objectMesh.materials);
````
### Shaders

```typescript
// returns shaders

const shaders = new CustomShader();
const vertexShader = shaders.getCustomVertexShader();
const fragmentShader = shaders.getCustomFragmentShader(bindGroupId);
````

### Bind Groups

```typescript
// creates and returns Bind Group Layout for the Textures and Sampler
const materialGroupLayout = await this.objectMaterial.createMaterialObjectBindGroupLayout(this.device);

// creates the Bind Group
await this.objectMaterial.createMaterialObjectBindGroup();
````

### Others

```typescript
// to debug the Buffer contents, after ending and render and submiting the queue use:
await this.objectMesh.copyBufferToCPU()
```