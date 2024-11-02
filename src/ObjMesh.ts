import { vec2, vec3 } from "gl-matrix";
import { MaterialMap } from "./types/MaterialMap";

export class ObjMesh {
   device: GPUDevice
   buffer: GPUBuffer
   bufferLayout: GPUVertexBufferLayout
   v: vec3[]
   vt: vec2[]
   vn: vec3[]
   materials: MaterialMap
   currentMaterial: number
   vertices: Float32Array
   vertexCount: number
   maxU: number;
   minU: number;
   maxV: number;
   minV: number;

   constructor() {
      this.v = [];
      this.vt = [];
      this.vn = [];
      this.materials = {};
      this.currentMaterial = 0;
      this.maxU = 0;
      this.minU = 0;
      this.maxV = 0;
      this.minV = 0;
   }

   /**
    * Reads .obj file, extracts position and texture data, creates and populates buffer and {@link MaterialMap}, 
    * and creates the {@link GPUVertexBufferLayout} used in the shader and render
    * @param device - The {@link GPUDevice} in use
    * @param url - The .obj file path/URL
    */
   async initialize (device: GPUDevice, url: string) {
      this.device = device;
      await this.read_file(url);

      this.vertexCount = this.vertices.length / 8; // x y z u v index_material tiling_u tiling_v
      
      const vertexStride = 32;
      let bufferSize = this.vertexCount * vertexStride;

      if (bufferSize % 4 !== 0) {
         bufferSize = Math.ceil(bufferSize / 4) * 4;
      }

      const descriptor: GPUBufferDescriptor = {
         size: bufferSize,
         usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
         mappedAtCreation: true
      };

      this.buffer = device.createBuffer(descriptor);

      new Float32Array(this.buffer.getMappedRange()).set(this.vertices);
      this.buffer.unmap();

      this.bufferLayout = {
         arrayStride: vertexStride,
         attributes: [
            {
               shaderLocation: 0,
               format: "float32x3",    //X,Y,Z
               offset: 0
            },
            {
               shaderLocation: 1,
               format: "float32x2",    //U,V
               offset: 12
            },
            {
               shaderLocation: 2,
               format: "uint32",       //Material/Texture Index
               offset: 20
            },
            {
               shaderLocation: 3,
               format: "float32x2",    //Tiling U e V
               offset: 24
            }  
         ]
      }
   }

   private async read_file(url: string){
      try {
         let result: number[] = [];

         const file_contents: string = await fetch(url).then(response => response.text());
         const lines = file_contents.split("\n");

         lines.forEach(line => {
            if (line.trim() === "") return;

            if(line[0] == "v"){

               if(line[1] == " "){
                  this.read_vertex_line(line);
               }

               if(line[1] == "t"){
                  this.read_texcoord_line(line);
               }

               if(line[1] == "n"){
                  this.read_normal_line(line);
               }
            }
            else if(line[0] == "f"){
               this.read_face_line(line, result);
            }
            else if(line[0] == "u"){
               this.read_material(line);
            }
         });
         
         this.vertices = new Float32Array(result);
      } catch (error) {
         console.log(`Error trying to read file ${url}: `, error);   
      }
   }

   private read_vertex_line(line: string){
      const components = line.replace("\r", "").replace(" ", "").trim().split(" ");
      
      //["v", "x", "y", "z"] -> vec3(x,y,z)
      const vertex: vec3 = [
         Number(components[1]).valueOf(),
         Number(components[2]).valueOf(),
         Number(components[3]).valueOf(),
      ];

      this.v.push(vertex);
   }

   private read_texcoord_line(line: string){
      const components = line.replace("\r", "").trim().split(" ");
      
      //["vt", "u", "v"] -> vec2(u,v)
      const texcoord: vec2 = [
         Number(components[1]).valueOf(),
         Number(components[2]).valueOf(),
      ];

      this.vt.push(texcoord);

      // Detectar tiling baseado no intervalo das UVs
      this.maxU = Math.max(this.maxU || 0, Number(components[1]).valueOf());
      this.minU = Math.min(this.minU || 0, Number(components[1]).valueOf());

      this.maxV = Math.max(this.maxV || 0, Number(components[2]).valueOf());
      this.minV = Math.min(this.minV || 0, Number(components[2]).valueOf());
   }

   private read_normal_line(line: string){
      const components = line.replace("\r", "").trim().split(" ");
      
      //["vn", "nx", "ny", "nz"] -> vec3(nx,ny,nz)
      const normal: vec3 = [
         Number(components[1]).valueOf(),
         Number(components[2]).valueOf(),
         Number(components[3]).valueOf(),
      ];

      this.vn.push(normal);
   }

   private read_face_line(line: string, result: number[]){
      line = line.replace("\n", "").replace("\r", "").trim();
      const vertex_descr = line.split(" ");
      
      //["f", "v1", "v2", "v3", ...]
      const triangle_count = vertex_descr.length - 3;

      for (let index = 0; index < triangle_count; index++) {
         this.read_corner(vertex_descr[1], result);
         this.read_corner(vertex_descr[2 + index], result);
         this.read_corner(vertex_descr[3 + index], result);
      }
   }

   private read_corner(vertex_descr: string, result: number[]){
      const values = vertex_descr.split("/");

      const v = this.v[Number(values[0]).valueOf() - 1];
      const vt = this.vt[Number(values[1]).valueOf() - 1] || [0, 0];
      
      result.push(v[0], v[1], v[2]);
      result.push(vt[0], vt[1]);
      
      result.push(Number(this.currentMaterial).valueOf());

      const [tilingU, tilingV] = this.calculateTiling();
      
      result.push(tilingU, tilingV);
   }

   private read_material(line: string){
      const components = line.replace("\r", "").trim().split(" ");
      
      //usemtl  < material name >
      const materialName: string = components[1];

      if(!(materialName in this.materials)){
         this.materials[materialName] = Object.keys(this.materials).length; //Add Index
      }

      this.currentMaterial = Number(this.materials[materialName]).valueOf();
   }

   private calculateTiling(): [number, number] {
      const tilingU = Math.max(1, Math.abs(this.maxU - this.minU));
      const tilingV = Math.max(1, Math.abs(this.maxV - this.minV));
      return [tilingU, tilingV];
   }

   /**
    * Log on the console the contents of the {@link GPUVertexBufferLayout}.
    * Note: Should be called after the {@link GPURenderPassEncoder}.end and {@link GPUQueue}.submit
    */
   async copyBufferToCPU() {
      const bufferSize = this.vertices.byteLength;
    
      const readBuffer = this.device.createBuffer({
        size: bufferSize,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        mappedAtCreation: false,
      });
    
      const commandEncoder = this.device.createCommandEncoder();
      commandEncoder.copyBufferToBuffer(
        this.buffer, 0,
        readBuffer, 0,
        bufferSize
      );
    
      const commands = commandEncoder.finish();
      this.device.queue.submit([commands]);
    
      await this.device.queue.onSubmittedWorkDone(); 
      await readBuffer.mapAsync(GPUMapMode.READ);
      const mappedRange = readBuffer.getMappedRange();
      const copiedData = new Float32Array(mappedRange);
    
      console.log('Buffer Data:', Array.from(copiedData));
      readBuffer.unmap();
   }
}