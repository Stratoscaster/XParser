import { LightningElement, api, track } from 'lwc';
export default class XParser extends LightningElement {
    
    tree;
    expression;
    variableMap;
    callback;
    operations;

    /**
     * Current Limitations:
     * 1. Expressions must contain unformatted numbers (no $, or commas)
     * 2. Only Functions, Single-Character Operations, Variables, and  may be used.
     */


    connectedCallback(){
        this._initializeOperations();
    }


    /**
     * Variable Map should be of format:
     * {
     *  'A': <value 1>,
     *  'B': <value 2>...
     * }
     * 
     * Callable function *must* be bound in order to properly function. 
     * 
     * E.g. Arrow Methods () => {} are automatically bound to the LWC class.
     * @param {String} expression 
     * @param {object} variableMap 
     * @param {CallableFunction} callback 
     */
    calculate(expression, variableMap=None, callback) {
        this.expression = expression;
        this.variableMap = variableMap;
        this.callback = callback;
    }



    _initializeOperations() {
        // Add custom operations here
        this.operations = {};
        const PLUS = '+';
        this.operations[PLUS] = new Operation(PLUS, false,
            (values) => {
                return values.reduce(
                    (total, value) => {
                    return total + value;
                })
            });
        
        const MINUS = '-';
        this.operations[MINUS] = new Operation(MINUS, false, 
            (values) => {
                return values.reduce(
                    (total, value) => {
                        return total - value;
                    }
                )
            });

        const MULTI = '*';
        this.operations[MULTI] = new Operation(MULTI, false, 
            (values) => {
                return values.reduce(
                    (product, factor) => {
                        return product * factor;
                    }
                )
            });

        const DIVI = '/';
        this.operations[DIVI] = new Operation(DIVI, false, 
            (values) => {
                return values.forEach(
                    (quotient, divisor) => {
                        return quotient / divisor;
                    }
                );
            });

        const MODULO = '%';
        this.operations[MODULO] = new Operation(DIVI, false, 
            (values) => {
                return values.forEeach(
                    (previousRemainder, divisor) =>{
                        return previousRemainder % divisor;
                    }
                )
            });
    }

}

class Value {
    isVariable;
    value;

    constructor(value, isVariable=false) {
        this.value = value;
        this.isVariable = isVariable;
    }
}



class Operation {
    name;   // This will be the term that the parser uses to search (e.g. ABS())
    isFunction;   //This differenciates between functions (e.g. ABS()) and single-char operations(e.g. +, -, *, /, ^)

    constructor(name, isFunction, executeFunction) {
        this.name = name;
        this.isFunction = isFunction;
        this.execute = this.executeFunction;
    }

    execute(values) {   // Function that you are overriding this with should accept a list of values
        // console.log(`Override this operation's execute function (${this.name})`);

    }

}
class Tree {

    root;

    static DROP_NULL = 'drop_null';
    static NULL_AS_ZERO = 'null_as_zero';
    static THROW_ERROR_ON_NULL = 'throw_error';
    constructor(item, nullHandlingMode=Tree.NULL_AS_ZERO) {
        this.nullHandlingMode = nullHandlingMode
        this.root = this._createRoot(item);
    }

    /**
     * For each node in the tree, recursively perform a given function with the node's item as a parameter.
     * @param {Node} node - Do not populate yourself unless you really know what you're doing.
     * @param {CallbackFunction} functionToPerformOnEach - Function to call with node's item as parameter.
     * @param {Boolean} providesItem - Depending on the setting, provide the item as a param or the node itself as a param (useful for branch operations)
     * @returns 
     */
    forEach(node = this.root, functionToPerformOnEach, providesItem=true) {
        // Depending on the setting, provide the item as a param or the node itself as a param (useful for branch operations)
        let param = providesItem ? node.item : node;    
        functionToPerformOnEach(param);
        
        let children = node.children;
        if (children === null || children.length === 0) { return; }
        for (let child of children) {
            this.forEach(child, functionToPerformOnEach, providesItem);
        }
    }

    _createRoot(item){
        return this._createNode(null, item, []);
    }

    _createNode(parent, item, children) {
        return new Node(parent, item, children, this.nullHandlingMode);
    }
}

class Node {
    
    parent;
    item;
    children;
    result;
    nullHandlingMode;

    constructor(parent, item, children, nullHandlingMode=Tree.NULL_AS_ZERO) {
        this.parent = parent;
        this.item = item;
        this.children = children;
        this.nullHandlingMode = nullHandlingMode;
        this.validate();
    }

    /**
     *  Start the execution chain.
     */
    execute() {
        if (this._childrenAreAllValuesOrNoChildren() && this.item instanceof Operation) {
            let values = this._getValuesOfChildren();
            values = this.validateValues(values);
            this.item.execute(values);   // If there are no deeper nodes to recurse, then execute this node's item.
        } else {
            for (let child of this.children) {
                child.execute();
            }
            if (this._childrenAreAllValuesOrNoChildren()) {
                let values = this._getValuesOfChildren();
                values = this.validateValues(values);
                this.item.execute(values);
            }
        }
    }

    validateValues(values) {
        let validatedValues = [];
        for (let value of values) {
            if (value === null) {
                if (this.nullHandlingMode === Tree.NULL_AS_ZERO) {
                    validatedValues.push(0);
                } else if (this.nullHandlingMode === Tree.DROP_NULL) {
                    continue;
                } else if (this.nullHandlingMode === Tree.THROW_ERROR_ON_NULL) {
                    throw new NullValueError('Value was null. Current Node being evaluated when null:' + JSON.stringify(this));
                } else {
                    console.log('WARNING: Invalid NullHandlingMode given: ' + this.nullHandlingMode + '. Falling back to NULL_AS_ZERO.');
                    validatedValues.push(0);
                }
            }

            validatedValues.push(value);
        }

        return validatedValues;
    }

    validate() {
        if (this.parent instanceof Node || this.parent === null) {  // If the Node has a parent, or if the parent is null (this Node is Root), valid.
            if (this.item !== undefined) {  // If the item is defined
                if (this.children instanceof List) {
                    return;
                }
            }
        }
        console.log('ERROR: Invalid parent of Node: ' + JSON.serialize(this, null, 2));
    }

    _childrenAreAllValuesOrNoChildren() {
        if (this.children.length === 0) { return false; }
        for (let child of this.children) {
            if (!(child.item instanceof Value)) {
                return false;
            }
        }
        return true;
    }

    _getValuesOfChildren() {
        let values = [];
        for (let child of this.children) {
            if (child.item instanceof Value) {
                values.push(child.item);
            }
        }
    }
}

class NullValueError extends Error { }

