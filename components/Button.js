import classNames from "classnames";

export const Button = ({ className, ...props }) => {
    return(
        <button className={classNames("font-bold py-2 px-4 rounded border-2", className)} {...props} />
    );
}