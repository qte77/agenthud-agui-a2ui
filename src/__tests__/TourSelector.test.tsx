import { render, screen, fireEvent } from "@testing-library/react";
import TourSelector from "../TourSelector";

describe("TourSelector", () => {
  const tours = [
    { id: "overview", label: "Overview", description: "Repo cards and summaries" },
    { id: "ai-projects", label: "AI Projects", description: "Deep dive into AI repos" },
    { id: "dev-tools", label: "Developer Tools", description: "Tooling and orchestration" },
  ];

  it("renders all tour options", () => {
    render(<TourSelector tours={tours} onSelect={vi.fn()} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(3);
  });

  it("shows tour label and description", () => {
    render(<TourSelector tours={tours} onSelect={vi.fn()} />);

    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Repo cards and summaries")).toBeInTheDocument();
    expect(screen.getByText("AI Projects")).toBeInTheDocument();
    expect(screen.getByText("Deep dive into AI repos")).toBeInTheDocument();
    expect(screen.getByText("Developer Tools")).toBeInTheDocument();
    expect(screen.getByText("Tooling and orchestration")).toBeInTheDocument();
  });

  it("calls onSelect with tour ID when clicked", () => {
    const onSelect = vi.fn();
    render(<TourSelector tours={tours} onSelect={onSelect} />);

    fireEvent.click(screen.getByText("AI Projects"));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("ai-projects");
  });
});
