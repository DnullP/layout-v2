/**
 * @module host/layout-v2/example/usage/tabDefinitionExample
 * @description tab 数据创建示例。
 *   这个文件演示如何通过 type + payload 描述不同类型的 tab，
 *   再把纯数据交给 tab section 或 store 使用。
 */

import { type TabSectionTabDefinition, type TabSectionTabType } from "../../src/tab-section/tabSectionModel";

export const TAB_TYPE_WELCOME: TabSectionTabType = "welcome";
export const TAB_TYPE_REVIEW: TabSectionTabType = "review";
export const TAB_TYPE_METRICS: TabSectionTabType = "metrics";

export interface WelcomeTabPayload {
    headline: string;
    items: string[];
}

export interface ReviewTabPayload {
    owner: string;
    pendingCount: number;
}

export interface MetricsTabPayload {
    score: number;
    trend: "up" | "flat" | "down";
}

/** 一个最简单的欢迎页 tab 示例。 */
export const welcomeTabExample: TabSectionTabDefinition = {
    id: "tab-welcome",
    title: "Welcome",
    type: TAB_TYPE_WELCOME,
    payload: {
        headline: "Workspace Overview",
        items: ["最近编辑", "快速入口", "常用命令"],
    } satisfies WelcomeTabPayload,
    content: "展示工作区概览、快捷入口和最近使用内容。",
    tone: "blue",
};

/** 一个偏审阅语义的 tab 示例。 */
export const reviewTabExample: TabSectionTabDefinition = {
    id: "tab-review",
    title: "Review",
    type: TAB_TYPE_REVIEW,
    payload: {
        owner: "Kai",
        pendingCount: 6,
    } satisfies ReviewTabPayload,
    content: "展示待处理改动、诊断信息和需要二次确认的内容。",
    tone: "amber",
};

/** 一个偏仪表盘语义的 tab 示例。 */
export const metricsTabExample: TabSectionTabDefinition = {
    id: "tab-metrics",
    title: "Metrics",
    type: TAB_TYPE_METRICS,
    payload: {
        score: 92,
        trend: "up",
    } satisfies MetricsTabPayload,
    content: "展示质量评分、趋势和核心指标。",
    tone: "green",
};

/**
 * @function createTabDefinitionExamples
 * @description 生成一组可直接用于 tab section 的示例 tabs。
 * @returns 示例 tabs 列表。
 */
export function createTabDefinitionExamples(): TabSectionTabDefinition[] {
    return [welcomeTabExample, reviewTabExample, metricsTabExample];
}