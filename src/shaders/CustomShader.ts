export class CustomShader {
   getCustomVertexShader(){
      const shader = `
         struct Uniforms {
            viewMatrix : mat4x4<f32>,       // Matriz de transformação da câmera
            projectionMatrix : mat4x4<f32> // Matriz de projeção
         };

         // Definições de entrada do vértice
         struct VertexInput {
            @location(0) position: vec3<f32>,  // Posição do vértice
            @location(1) uv: vec2<f32>,        // Coordenadas UV
            @location(2) materialIndex: u32,   // Índice do material/textura
            @location(3) tiling: vec2<f32>   // Tiling U e V
         };

         // Definições de saída do vértice
         struct VertexOutput {
            @location(0) uv: vec2<f32>,              // Coordenadas UV aplicadas
            @location(1) @interpolate(flat) fragmentMaterialIndex: u32,    // Índice do material
            @builtin(position) position: vec4<f32>,  // Posição final do vértice
         };

         @group(0) @binding(0) var<uniform> uniforms: Uniforms; 

         // Vertex Shader - Aplica transformação de posição e UV
         @vertex
         fn vs_custom_main(input: VertexInput) -> VertexOutput {
            var output: VertexOutput;
            
            // Passa o índice de material para o fragment shader
            output.fragmentMaterialIndex = input.materialIndex;

            // Transformação do vértice para espaço de tela
            let viewPosition = uniforms.viewMatrix * vec4<f32>(input.position, 1.0);
            output.position = uniforms.projectionMatrix * viewPosition; 
            
            // Aplicando o tiling nas coordenadas UV
            output.uv = input.uv * input.tiling;

            return output;
         }
      `;

      return shader;
   }

   getCustomFragmentShader(bindGroupId: number){
      let shader = `
         struct VertexOutput {
            @builtin(position) position: vec4<f32>,
            @location(0) uv: vec2<f32>,
            @location(1) @interpolate(flat) fragmentMaterialIndex: u32,
         };

         // Entrada do fragment shader
         @group(${bindGroupId}) @binding(0) var textureArray: texture_2d_array<f32>;
         @group(${bindGroupId}) @binding(1) var textureArraySampler: sampler;

         // Fragment Shader - Amostra a textura e aplica o material correto
         @fragment
         fn fs_custom_main(input: VertexOutput) -> @location(0) vec4<f32> {
            let uv = input.uv;
            let layer = input.fragmentMaterialIndex;

            // if (layer == 0) {
            //    return vec4(1.0, 0.0, 0.0, 1.0);  // Vermelho para índice 0
            // } else if (layer == 1) {
            //    return vec4(0.0, 1.0, 0.0, 1.0);  // Verde para índice 1
            // } else if (layer == 2) {
            //    return vec4(0.0, 1.0, 1.0, 1.0);  // Teal para índice 2
            // } else if (layer < 0){
            //    return vec4(1.0, 0.0, 1.0, 1.0);  // Roxo para índice < 0
            // } else if (layer >= 50){
            //    return vec4(1.0, 0.0, 1.0, 1.0);  // Azul para índice >= 9
            // } else {
            //    return vec4(1.0, 1.0, 1.0, 1.0);  // Azul para índice >= 9
            // }

            // // Valor padrão para índices fora do intervalo
            // return vec4(1.0, 1.0, 1.0, 1.0);  // Branco

            let color = textureSample(
               textureArray, textureArraySampler, uv, layer
            );
            return color;
         }
      `;
      return shader;
   }
}
