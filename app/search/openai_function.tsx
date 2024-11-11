import { zodFunction } from "openai/helpers/zod";
import { ParsedFunctionToolCall } from "openai/resources/beta/chat/completions";
import { z } from "zod";
import { SimplifiedProduct } from "./action";


export const LessThanParams = z.object({
  upper: z.number(),
});

export const GreaterThanParams = z.object({
  lower: z.number(),
});

export const BetweenParams = z.object({
  lower: z.number(),
  upper: z.number(),
});

export const openAiTools = [
  zodFunction({
    name: 'price_less_than',
    description: 'list products where price is less than input',
    parameters: LessThanParams,
  }),
  zodFunction({
    name: 'price_greater_than',
    description: 'list products where price is greater than input',
    parameters: GreaterThanParams,
  }),
  zodFunction({
    name: 'price_between',
    description: 'list products where price is between lower and upper',
    parameters: BetweenParams,
  })
]

export function lessThan(products: SimplifiedProduct[], {upper}: z.infer<typeof LessThanParams>) {
  return products.filter(product => (product.price <= upper));
}

export function greaterThan(products: SimplifiedProduct[], {lower}: z.infer<typeof GreaterThanParams>) {
  return products.filter(product => (product.price >= lower));
}

export function between(products: SimplifiedProduct[], {lower, upper}: z.infer<typeof BetweenParams>) {
  return products.filter(product => (product.price >= lower && product.price <= upper));
}

export function getFunctionCallResult(toolCall: ParsedFunctionToolCall, products: SimplifiedProduct[]): SimplifiedProduct[] {
  const {name: functionName } = toolCall.function;
    switch(functionName) {
      case "price_greater_than": {
        const args = toolCall.function.parsed_arguments as z.infer<typeof GreaterThanParams>;
        const filteredProducts = greaterThan(products, args);
        return products.filter(product => filteredProducts.some(filteredProduct => product.title === filteredProduct.title))
      }   
      case "price_less_than":  {
        const args = toolCall.function.parsed_arguments as z.infer<typeof LessThanParams>;
        const filteredProducts = lessThan(products, args);
        return products.filter(product => filteredProducts.some(filteredProduct => product.title === filteredProduct.title))
      }
      case "price_between": {
        const args = toolCall.function.parsed_arguments as z.infer<typeof BetweenParams>;
        const filteredProducts = between(products, args);
        return products.filter(product => filteredProducts.some(filteredProduct => product.title === filteredProduct.title))
      }
    }
    return products;
}
