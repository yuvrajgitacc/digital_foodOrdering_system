import { createContext, useContext, useReducer, useCallback } from 'react';

const CartContext = createContext();

const cartReducer = (state, action) => {
    switch (action.type) {
        case 'ADD_ITEM': {
            const existingIndex = state.items.findIndex(
                item => item.menu_item_id === action.payload.menu_item_id &&
                    JSON.stringify(item.selectedAddons) === JSON.stringify(action.payload.selectedAddons)
            );
            if (existingIndex >= 0) {
                const newItems = [...state.items];
                newItems[existingIndex].quantity += action.payload.quantity || 1;
                return { ...state, items: newItems };
            }
            return { ...state, items: [...state.items, { ...action.payload, quantity: action.payload.quantity || 1 }] };
        }
        case 'REMOVE_ITEM':
            return { ...state, items: state.items.filter((_, i) => i !== action.payload) };
        case 'UPDATE_QUANTITY': {
            const newItems = [...state.items];
            newItems[action.payload.index].quantity = Math.max(1, action.payload.quantity);
            return { ...state, items: newItems };
        }
        case 'SET_NOTES':
            return { ...state, specialNotes: action.payload };
        case 'CLEAR_CART':
            return { ...state, items: [], specialNotes: '' };
        case 'SET_TABLE':
            return { ...state, tableId: action.payload.id, tableNumber: action.payload.number };
        default:
            return state;
    }
};

export function CartProvider({ children }) {
    const [state, dispatch] = useReducer(cartReducer, {
        items: [],
        tableId: null,
        tableNumber: null,
        specialNotes: '',
    });

    const addItem = useCallback((item) => dispatch({ type: 'ADD_ITEM', payload: item }), []);
    const removeItem = useCallback((index) => dispatch({ type: 'REMOVE_ITEM', payload: index }), []);
    const updateQuantity = useCallback((index, quantity) => dispatch({ type: 'UPDATE_QUANTITY', payload: { index, quantity } }), []);
    const setNotes = useCallback((notes) => dispatch({ type: 'SET_NOTES', payload: notes }), []);
    const clearCart = useCallback(() => dispatch({ type: 'CLEAR_CART' }), []);
    const setTable = useCallback((id, number) => dispatch({ type: 'SET_TABLE', payload: { id, number } }), []);

    const totalItems = state.items.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = state.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = Math.round(subtotal * 5) / 100;
    const total = subtotal + tax;

    return (
        <CartContext.Provider value={{
            ...state, addItem, removeItem, updateQuantity, setNotes, clearCart, setTable,
            totalItems, subtotal, tax, total,
        }}>
            {children}
        </CartContext.Provider>
    );
}

export const useCart = () => useContext(CartContext);
