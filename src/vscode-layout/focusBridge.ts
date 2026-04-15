export type LayoutFocusAttributes = Record<string, string | number | boolean | undefined>;

export interface ActivityBarFocusBridge<TBar, TIcon> {
    getBarAttributes?: (bar: TBar) => LayoutFocusAttributes | undefined;
    getIconAttributes?: (bar: TBar, icon: TIcon) => LayoutFocusAttributes | undefined;
}

export interface PanelSectionFocusBridge<TSection, TPanel> {
    getSectionAttributes?: (section: TSection) => LayoutFocusAttributes | undefined;
    getPanelAttributes?: (section: TSection, panel: TPanel) => LayoutFocusAttributes | undefined;
    getContentAttributes?: (section: TSection, panel: TPanel | null) => LayoutFocusAttributes | undefined;
    getEmptyAttributes?: (section: TSection) => LayoutFocusAttributes | undefined;
    getHeaderAttributes?: (section: TSection, panel: TPanel) => LayoutFocusAttributes | undefined;
}

export interface TabSectionFocusBridge<TSection, TTab> {
    getSectionAttributes?: (section: TSection) => LayoutFocusAttributes | undefined;
    getTabAttributes?: (section: TSection, tab: TTab) => LayoutFocusAttributes | undefined;
    getContentAttributes?: (section: TSection, tab: TTab | null) => LayoutFocusAttributes | undefined;
}

export interface VSCodeLayoutFocusBridge<TBar, TIcon, TPanelSection, TPanel, TTabSection, TTab> {
    activityBar?: ActivityBarFocusBridge<TBar, TIcon>;
    panels?: PanelSectionFocusBridge<TPanelSection, TPanel>;
    tabs?: TabSectionFocusBridge<TTabSection, TTab>;
}

export function mergeLayoutFocusAttributes(
    ...attributeSets: Array<LayoutFocusAttributes | undefined>
): LayoutFocusAttributes | undefined {
    const merged: LayoutFocusAttributes = {};

    attributeSets.forEach((attributes) => {
        if (!attributes) {
            return;
        }

        Object.entries(attributes).forEach(([key, value]) => {
            if (value === undefined) {
                return;
            }

            merged[key] = value;
        });
    });

    return Object.keys(merged).length > 0 ? merged : undefined;
}

export function createActivityBarFocusBridge<TBar, TIcon>(
    bridge: ActivityBarFocusBridge<TBar, TIcon>,
): ActivityBarFocusBridge<TBar, TIcon> {
    return bridge;
}

export function createPanelSectionFocusBridge<TSection, TPanel>(
    bridge: PanelSectionFocusBridge<TSection, TPanel>,
): PanelSectionFocusBridge<TSection, TPanel> {
    return bridge;
}

export function createTabSectionFocusBridge<TSection, TTab>(
    bridge: TabSectionFocusBridge<TSection, TTab>,
): TabSectionFocusBridge<TSection, TTab> {
    return bridge;
}

export function createVSCodeLayoutFocusBridge<
    TBar,
    TIcon,
    TPanelSection,
    TPanel,
    TTabSection,
    TTab,
>(
    bridge: VSCodeLayoutFocusBridge<TBar, TIcon, TPanelSection, TPanel, TTabSection, TTab>,
): VSCodeLayoutFocusBridge<TBar, TIcon, TPanelSection, TPanel, TTabSection, TTab> {
    return bridge;
}