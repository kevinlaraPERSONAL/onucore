// onucore brand mark: a "C" (core) opening to the right around a red center dot.
// ring / dot default to the brand colors; override ring on dark surfaces if needed.
export default function OcIcon({
  size = 48,
  ring = "#5c6265",
  dot = "#e5484d",
  style,
}: {
  size?: number;
  ring?: string;
  dot?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 288 288" xmlns="http://www.w3.org/2000/svg" aria-hidden style={style}>
      <path fill={ring} d="M145.78,218.09c-40.85,0-74.09-33.24-74.09-74.09s33.24-74.09,74.09-74.09c29.17,0,54.89,16.67,66.98,42.39h71.4c-.76-3.34-1.64-6.66-2.65-9.94C263.13,42.36,208.58,2.05,145.78,2.05,67.51,2.05,3.84,65.73,3.84,144s63.68,141.95,141.95,141.95c62.8,0,117.34-40.31,135.73-100.29,1.01-3.29,1.88-6.61,2.65-9.95h-71.4c-12.09,25.72-37.81,42.39-66.98,42.39Z" />
      <circle fill={dot} cx="145.78" cy="144" r="29.7" />
    </svg>
  );
}
