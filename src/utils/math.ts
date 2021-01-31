export function transform(inputValue: number, inputRange: [number, number], outputRange: [number, number]) {
  const minInput = Math.min(...inputRange)
  const maxInput = Math.max(...inputRange)

  const clamped = Math.max(minInput, Math.min(maxInput, inputValue))

  const inputSize = Math.abs(inputRange[1] - inputRange[0]) 
  const outputSize = Math.abs(outputRange[1] - outputRange[0])
  
  const ratio = (clamped - minInput) / inputSize

  if (outputRange[0] > outputRange[1]) {
    return outputRange[0] - ratio * outputSize
  }

  return outputRange[0] + ratio * outputSize
}
