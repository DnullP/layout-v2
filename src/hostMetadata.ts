export type LayoutHostMetadata = Record<string, unknown>;

export interface LayoutMetadataCarrier {
    meta?: LayoutHostMetadata;
}

export type LayoutHostMetadataUpdater = (
    metadata: LayoutHostMetadata,
) => LayoutHostMetadata | undefined;

const EMPTY_METADATA: LayoutHostMetadata = Object.freeze({}) as LayoutHostMetadata;

function isMetadataEmpty(metadata: LayoutHostMetadata | undefined): boolean {
    return !metadata || Object.keys(metadata).length === 0;
}

export function getLayoutMetadata(
    carrier: LayoutMetadataCarrier | null | undefined,
): LayoutHostMetadata {
    return carrier?.meta ?? EMPTY_METADATA;
}

export function setLayoutMetadata<T extends LayoutMetadataCarrier>(
    carrier: T,
    metadata: LayoutHostMetadata | undefined,
): T {
    if (carrier.meta === metadata) {
        return carrier;
    }

    if (isMetadataEmpty(metadata)) {
        if (carrier.meta === undefined) {
            return carrier;
        }

        const nextCarrier = { ...carrier } as T & LayoutMetadataCarrier;
        delete nextCarrier.meta;
        return nextCarrier as T;
    }

    return {
        ...carrier,
        meta: metadata,
    };
}

export function updateLayoutMetadata<T extends LayoutMetadataCarrier>(
    carrier: T,
    updater: LayoutHostMetadataUpdater,
): T {
    return setLayoutMetadata(carrier, updater(getLayoutMetadata(carrier)));
}

export const getHostMetadata = getLayoutMetadata;

export const setHostMetadata = setLayoutMetadata;

export const updateHostMetadata = updateLayoutMetadata;