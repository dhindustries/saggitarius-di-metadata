import { Typing } from "@saggitarius/typing";
import { IDefinitionResolver, Dependency, Definition, Context } from "@saggitarius/di";
import { Metadata } from "@saggitarius/metadata";
import { IModuleLoader } from "@saggitarius/module-loader"

export interface IMetadataProvider {
    getMetadata(type: Type): Promise<Metadata.Any>;
}
export namespace IMetadataProvider {
    export const Type = Typing.type<IMetadataProvider>("@saggitarius/di-metadata::IMetadataProvider");
}

declare var global;
declare var window;

@Typing.register("@saggitarius/di-metadata::MetadataDefinitionResolver")
export class MetadataDefinitionResolver implements IDefinitionResolver {

    public constructor(
        private metadataProvider: IMetadataProvider,
        private moduleLoader?: IModuleLoader,
    ) {}

    public async resolve<T>(ctx: Context, ty: Definition<T> | Type<T>): Promise<Definition.Provision<T>> {
        debugger;
        let type: Type<T>;
        let def: Definition.Type<T>;
        if (Typing.isType(ty)) {
            type = ty;
            def = Definition.makeType(ty);
        } 
        if (Definition.isType(ty)) {
            def = ty;
            type = ty.type;
        }
        if (type && def) {
            const metadata = await this.metadataProvider.getMetadata(type);
            this.applyMetadata(ctx, def, metadata);
        }
        return def;
    }

    private applyMetadata(ctx: Context, def: Definition.Type, md: Metadata.Any) {
        if (!md) {
            return;
        }
        if (md.kind === Metadata.Kind.Class) {
            this.applyClass(ctx, def, md);
        }
    }

    private applyClass(ctx: Context, def: Definition.Type, cls: Metadata.Class) {
        if (cls.constructor) {
            if (!def.args) {
                def.args = [];
            }
            const args: Array<Dependency | undefined> = def.args;
            const namedParams: Record<string, Metadata.Parameter> = {};
            for (const param of cls.constructor.parameters) {
                if (param.name) {
                    namedParams[param.name] = param;
                }
                args[param.index] = this.getParameter(ctx, param);
            }
            const argKeys = Object.keys(def.args || []);
            const paramKeys = Object.keys(namedParams);
            const keys = argKeys.filter((key) => paramKeys.includes(key));
            for (const key of keys) {
                const param = namedParams[key];
                args[param.index] = this.getParameter(ctx, param);
                delete args[key];
            }
        }
        if (!def.factory) {
            def.factory = this.getConstructorFactory(def.type);
        }
    }

    private getParameter(ctx: Context, param: Metadata.Parameter): Dependency | undefined {
        if (param.type && param.type.name) {
            return Typing.type(param.type.name);
        }
        return undefined;
    }

    private getConstructorFactory(type: Type): (...args: unknown[]) => Promise<unknown> | undefined {
        debugger;
        const modulePath = typeof(type["module"]) === "string"
            ? type["module"] : "";

        const classPath = typeof(type["path"]) === "string"
            ? type["path"] : "";

        if ((!this.moduleLoader && modulePath) || !classPath) {
            return undefined;
        }
        return async (...args) => {
            debugger;
            const module = modulePath
                ? await this.moduleLoader.loadModule(modulePath)
                : global || window;
            
            const cls = module[classPath];

            return new cls(...args);
        };
    }
}
