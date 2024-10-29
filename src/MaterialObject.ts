import { MaterialMap } from "./types/MaterialMap";
import { MaterialTextures } from "./types/MaterialTextures";
import { MaterialViews } from "./types/MaterialViews";
import { MaterialSamplers } from "./types/MaterialSamplers";
import { MaterialURLs } from "./types/MaterialUrls";

export class MaterialObject {
    device: GPUDevice

    textures: MaterialTextures = {};
    views: MaterialViews = {};
    samplers: MaterialSamplers = {};
    bindGroupLayout: GPUBindGroupLayout;
    bindings: GPUBindGroupEntry[] = [];
    bindGroup: GPUBindGroup;

    textureArray: GPUTexture;
    view: GPUTextureView;
    sampler: GPUSampler;

    async initialize(device: GPUDevice, urls: MaterialURLs, materialMap: MaterialMap) {
        this.device = device;
        const depthLayers = Object.keys(materialMap).length;

        console.log(`Layers : ${depthLayers}`);

        await this.integrateTextures(urls, materialMap);

        console.log(this.textureArray);

         this.view = this.textureArray.createView({
            format: "rgba8unorm",
            dimension: "2d-array",
            aspect: "all",
            baseMipLevel: 0,
            mipLevelCount: 1,
            baseArrayLayer: 0,
            arrayLayerCount: depthLayers,
        });

        this.sampler = this.device.createSampler({
            magFilter: "linear",
            minFilter: "linear",
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });
    }

    async integrateTextures(textureURLs: {[materialName: string] : string}, materialMap: MaterialMap){
        const depthLayers = Object.keys(materialMap).length;
        const textureDescriptor: GPUTextureDescriptor = {
            dimension: '2d',
            size: {
                width: 1920,
                height: 1080,
                depthOrArrayLayers: depthLayers
            },
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        }

        this.textureArray = this.device.createTexture(textureDescriptor);

        let layer = 0;
        for(const material of Object.keys(materialMap)){
            const url = textureURLs[material] || "default.jpg";
            console.log(`Loading texture for material: ${material}, Layer: ${layer}, URL: ${url}`);
            await this.loadImageBitmaps(url, layer);
            
            layer++;
        }

        console.log(`Loaded textures: ${layer}`);
    }

    async loadAndResizeImage(imageData: ImageBitmap): Promise<ImageBitmap> {    
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;

        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(imageData, 0, 0, 1920, 1080);
    
        return createImageBitmap(canvas);
    }

    async loadImageBitmaps(url: string, layer: number) {
        const filename: string = "dist/img/materials/" + url;
        const response: Response = await fetch(filename);
        const blob: Blob = await response.blob();

        let imageData = await createImageBitmap(blob);
        if(imageData.width != 1920 || imageData.height != 1080){
            imageData = await this.loadAndResizeImage(imageData);
        }

        this.device.queue.copyExternalImageToTexture(
            {source: imageData},
            {texture: this.textureArray, origin: {x: 0, y: 0, z: layer}},
            [1920, 1080]
        );
    }

    async createMaterialObjectBindGroupLayout(device: GPUDevice = this.device){
        this.bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { 
                        viewDimension: "2d-array",
                        sampleType: "float" 
                    },  // Um único binding para o array de texturas
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},  // Binding para o sampler
                }
            ],
        });
        return this.bindGroupLayout;
    }


    async createMaterialObjectBindGroup(device: GPUDevice = this.device){
        if (!this.view || !this.sampler) {
            console.error("View ou Sampler não foram inicializados corretamente.");
            return;
        }
        this.bindGroup = device.createBindGroup({
            label: "Material Object Bind Group",
            layout: this.bindGroupLayout,
            entries: [
                {
                    binding: 0,
                    resource: this.view,
                },
                {
                    binding: 1,
                    resource: this.sampler,
                }
            ],
        });

        console.log("BindGroup criado:", this.bindGroup);
        
        return this.bindGroup;
    }
    async getFrameObjectLayout(materialMap: MaterialMap){
        const entries = await this.getBindGroupLayoutEntries(materialMap);
        
        const layout = this.device.createBindGroupLayout({
            label: "ObjectFrameBindGroup",
            entries:[
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {}
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: {
                        type: "read-only-storage",
                        hasDynamicOffset: false
                    }
                },
                ...entries
            ]
        });

        return layout;
    }

    async getBindGroupLayoutEntries(materialMap: MaterialMap){
        return Array.from({ length: Object.keys(materialMap).length * 2 }, (_, index) => {
            if(index % 2 === 0){
                return {
                    binding: index + 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: {},
                }
            } else {
                return {
                    binding: index + 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: {},
                }
            }
        });
    }
}