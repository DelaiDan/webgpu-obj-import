export class CustomShader {
   /**
    * Returns a Vertex Shader with viewMatrix and projectionMatrix aswell as the attributes specified in the {@link GPUVertexBufferLayout}
    * @returns string
    */
   getCustomVertexShader(){
      const shader = `
         struct Uniforms {
            viewMatrix : mat4x4<f32>,
            projectionMatrix : mat4x4<f32>
         };

         // Definições de entrada do vértice
         struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) uv: vec2<f32>,
            @location(2) materialIndex: u32,
            @location(3) tiling: vec2<f32>
         };

         // Definições de saída do vértice
         struct VertexOutput {
            @location(0) uv: vec2<f32>,
            @location(1) @interpolate(flat) fragmentMaterialIndex: u32,
            @builtin(position) position: vec4<f32>,
         };

         @group(0) @binding(0) var<uniform> uniforms: Uniforms; 

         // Vertex Shader - Aplica transformação de posição e UV
         @vertex
         fn vs_custom_main(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            
            output.fragmentMaterialIndex = input.materialIndex;

            let viewPosition = uniforms.viewMatrix * vec4<f32>(input.position, 1.0);
            output.position = uniforms.projectionMatrix * viewPosition; 
            
            output.uv = input.uv * input.tiling;

            return output;
         }
      `;

      return shader;
   }

   /**
    * Returns a Fragment Shader sampling the textures from the texture_2d_array
    * @param bindGroupId - The ID of the Bind Group that the Fragment Shader will be applied to
    * @returns string
    */
   getCustomFragmentShader(bindGroupId: number){
      let shader = `
         struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
            @location(1) @interpolate(flat) fragmentMaterialIndex: u32,
         };

         @group(${bindGroupId}) @binding(0) var textureArray: texture_2d_array<f32>;
         @group(${bindGroupId}) @binding(1) var textureArraySampler: sampler;

         @fragment
         fn fs_custom_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let uv = input.uv;
            let layer = input.fragmentMaterialIndex;

            let color = textureSample(
               textureArray, textureArraySampler, uv, layer
            );
            return color;
         }
      `;
      return shader;
   }
}
