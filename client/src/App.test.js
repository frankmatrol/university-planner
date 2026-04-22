import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders university planner heading", () => {
  render(<App />);
  const heading = screen.getByText(/university planner/i);
  expect(heading).toBeInTheDocument();
});