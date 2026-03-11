import { useState } from "react";
import { useAtlasPlatform } from "./ui/hooks/useAtlasPlatform";
import { Header } from "./ui/components/Header";
import { Dashboard } from "./ui/components/Dashboard";
import { OutreachKanban } from "./ui/components/OutreachKanban";
import { OrgChartExplorer } from "./ui/components/OrgChartExplorer";
import { StrategyBrief } from "./ui/components/StrategyBrief";

function LoadingState() {
  return (
    <div className="state-card">
      <h2>Booting Atlas intelligence workspace</h2>
      <p>Running connector services, signal engine, scoring model, and agent workflows.</p>
    </div>
  );
}

function ErrorState({ message }) {
  return (
    <div className="state-card error">
      <h2>Unable to initialize Atlas platform</h2>
      <p>{message}</p>
    </div>
  );
}

export default function App() {
  const { workspace, metrics, loading, refreshing, error, refresh, moveKanbanCard } = useAtlasPlatform();
  const [activeView, setActiveView] = useState("dashboard");

  if (loading) return <LoadingState />;
  if (error && !workspace) return <ErrorState message={error} />;
  if (!workspace || !metrics) return <ErrorState message="Atlas workspace is empty." />;

  return (
    <main className="atlas-app">
      <Header
        activeView={activeView}
        onChangeView={setActiveView}
        generatedAt={workspace.generatedAt}
        dataSource={workspace.dataSource}
        onRefresh={refresh}
        refreshing={refreshing}
      />

      {error ? <div className="inline-error">{error}</div> : null}

      {activeView === "dashboard" && <Dashboard workspace={workspace} metrics={metrics} />}
      {activeView === "kanban" && <OutreachKanban kanban={workspace.kanban} onMoveCard={moveKanbanCard} />}
      {activeView === "org" && (
        <OrgChartExplorer
          opportunities={workspace.opportunities}
          orgChartsByAccount={workspace.orgChartsByAccount}
        />
      )}
      {activeView === "brief" && <StrategyBrief brief={workspace.strategyBrief} />}
    </main>
  );
}
