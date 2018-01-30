'use strict';

module.exports = function (acorn) {
  var acornVersion = acorn.version.match(/^5\.(\d+)\./)
  if (!acornVersion || Number(acornVersion[1]) < 2) {
    throw new Error("Unsupported acorn version " + acorn.version + ", please use acorn 5 >= 5.2");
  }
  var tt = acorn.tokTypes;

  var getCheckLVal = function (origCheckLVal) {
    return function (expr, bindingType, checkClashes) {
      var self = this
      if (expr.type == "ObjectPattern") {
        expr.properties.forEach(function (prop) {
          self.checkLVal(prop, bindingType, checkClashes)
        })
        return
      } else if (expr.type === "Property") {
        // AssignmentProperty has type == "Property"
        return this.checkLVal(expr.value, bindingType, checkClashes)
      }
      return origCheckLVal.apply(this, arguments)
    }
  }

  acorn.plugins.objectSpread = function objectSpreadPlugin(instance) {
    instance.extend("parseProperty", function (nextMethod) {
      return function (isPattern, refDestructuringErrors) {
        if (this.options.ecmaVersion >= 6 && this.type === tt.ellipsis) {
          var prop
          if (isPattern) {
            prop = this.startNode()
            this.next()
            prop.argument = this.parseIdent()
            this.finishNode(prop, "RestElement")
          } else {
            prop = this.parseSpread(refDestructuringErrors)
          }
          if (this.type === tt.comma) {
            if (isPattern) {
              this.raise(this.start, "Comma is not permitted after the rest element")
            } else if (refDestructuringErrors && refDestructuringErrors.trailingComma < 0) {
              refDestructuringErrors.trailingComma = this.start
            }
          }
          return prop
        }

        return nextMethod.apply(this, arguments)
      }
    })
    instance.extend("checkPropClash", function (nextMethod) {
      return function (prop, propHash) {
        if (prop.type == "SpreadElement" || prop.type == "RestElement") return
        return nextMethod.apply(this, arguments)
      }
    })
    instance.extend("checkLVal", getCheckLVal)
    instance.extend("toAssignable", function (nextMethod) {
      return function (node, isBinding) {
        var self = this
        if (this.options.ecmaVersion >= 6 && node) {
          if (node.type == "ObjectExpression") {
            node.type = "ObjectPattern"
            node.properties.forEach(function (prop) {
              self.toAssignable(prop, isBinding)
            })
            return node
          } else if (node.type === "Property") {
            // AssignmentProperty has type == "Property"
            if (node.kind !== "init") this.raise(node.key.start, "Object pattern can't contain getter or setter")
            return this.toAssignable(node.value, isBinding)
          } else if (node.type === "SpreadElement") {
            node.type = "RestElement"
            return this.toAssignable(node.argument, isBinding)
          }
        }
        return nextMethod.apply(this, arguments)
      }
    })
    instance.extend("checkPatternExport", function (nextMethod) {
      return function (exports, pat) {
        var self = this
        if (pat.type == "ObjectPattern") {
          pat.properties.forEach(function(prop) {
            self.checkPatternExport(exports, prop)
          })
          return
        } else if (pat.type === "Property") {
          return this.checkPatternExport(exports, pat.value)
        } else if (pat.type === "RestElement") {
          return this.checkPatternExport(exports, pat.argument)
        }
        nextMethod.apply(this, arguments)
      }
    })
  };

  return acorn;
};
