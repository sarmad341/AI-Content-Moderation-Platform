function Loading({ message = "Loading..." }) {
  return (
    <div className="loading">
      <span className="loading__spinner" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}

export default Loading;
