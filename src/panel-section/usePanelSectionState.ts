import { useReducer } from "react";
import {
    createPanelSectionsState,
    focusPanelSectionPanel,
    getPanelSectionById,
    insertPanelSectionPanel,
    movePanelSectionPanel,
    removePanelSection,
    removePanelSectionPanel,
    setPanelSectionCollapsed,
    upsertPanelSection,
    type PanelSectionPanelDefinition,
    type PanelSectionPanelMove,
    type PanelSectionStateItem,
    type PanelSectionsState,
} from "./panelSectionModel";

export interface UsePanelSectionStateOptions {
    initialState: PanelSectionsState;
}

export interface PanelSectionStateController {
    state: PanelSectionsState;
    getSection: (sectionId: string) => PanelSectionStateItem | null;
    focusPanel: (sectionId: string, panelId: string) => void;
    movePanel: (move: PanelSectionPanelMove) => void;
    insertPanel: (sectionId: string, panel: PanelSectionPanelDefinition, targetIndex: number) => void;
    removePanel: (sectionId: string, panelId: string) => void;
    setCollapsed: (sectionId: string, isCollapsed: boolean) => void;
    upsertSection: (section: PanelSectionStateItem) => void;
    removeSection: (sectionId: string) => void;
    resetState: (state: PanelSectionsState) => void;
}

type PanelSectionAction =
    | {
        type: "focus";
        sectionId: string;
        panelId: string;
    }
    | {
        type: "move";
        move: PanelSectionPanelMove;
    }
    | {
        type: "insert";
        sectionId: string;
        panel: PanelSectionPanelDefinition;
        targetIndex: number;
    }
    | {
        type: "remove-panel";
        sectionId: string;
        panelId: string;
    }
    | {
        type: "set-collapsed";
        sectionId: string;
        isCollapsed: boolean;
    }
    | {
        type: "upsert";
        section: PanelSectionStateItem;
    }
    | {
        type: "remove-section";
        sectionId: string;
    }
    | {
        type: "reset";
        state: PanelSectionsState;
    };

function panelSectionReducer(
    state: PanelSectionsState,
    action: PanelSectionAction,
): PanelSectionsState {
    if (action.type === "focus") {
        return focusPanelSectionPanel(state, action.sectionId, action.panelId);
    }

    if (action.type === "move") {
        return movePanelSectionPanel(state, action.move);
    }

    if (action.type === "insert") {
        return insertPanelSectionPanel(state, action.sectionId, action.panel, action.targetIndex);
    }

    if (action.type === "remove-panel") {
        return removePanelSectionPanel(state, action.sectionId, action.panelId);
    }

    if (action.type === "set-collapsed") {
        return setPanelSectionCollapsed(state, action.sectionId, action.isCollapsed);
    }

    if (action.type === "upsert") {
        return upsertPanelSection(state, action.section);
    }

    if (action.type === "remove-section") {
        return removePanelSection(state, action.sectionId);
    }

    return action.state;
}

export function usePanelSectionState(
    options: UsePanelSectionStateOptions,
): PanelSectionStateController {
    const [state, dispatch] = useReducer(panelSectionReducer, options.initialState);

    return {
        state,
        getSection: (sectionId) => getPanelSectionById(state, sectionId),
        focusPanel: (sectionId, panelId) => {
            dispatch({
                type: "focus",
                sectionId,
                panelId,
            });
        },
        movePanel: (move) => {
            dispatch({
                type: "move",
                move,
            });
        },
        insertPanel: (sectionId, panel, targetIndex) => {
            dispatch({
                type: "insert",
                sectionId,
                panel,
                targetIndex,
            });
        },
        removePanel: (sectionId, panelId) => {
            dispatch({
                type: "remove-panel",
                sectionId,
                panelId,
            });
        },
        setCollapsed: (sectionId, isCollapsed) => {
            dispatch({
                type: "set-collapsed",
                sectionId,
                isCollapsed,
            });
        },
        upsertSection: (section) => {
            dispatch({
                type: "upsert",
                section,
            });
        },
        removeSection: (sectionId) => {
            dispatch({
                type: "remove-section",
                sectionId,
            });
        },
        resetState: (nextState) => {
            dispatch({
                type: "reset",
                state: nextState,
            });
        },
    };
}

export { createPanelSectionsState };